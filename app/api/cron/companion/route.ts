import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {
  getDailyIntention,
  needsReconnect,
  getUserAnnotationHistory,
  getACIPProfile,
  summarizeAnnotationPatterns,
  findSimilarAnnotations,
} from '@/lib/companion';
import { getRecentSummaries } from '@/lib/chat-persistence';
import { getTodayEvents } from '@/lib/google-calendar';
import { scoreEventPersonalized } from '@/lib/scoring';
import { generateCoachingPrompt } from '@/lib/coaching';
import { sendCoachingPrompt, sendTelegramMessage } from '@/lib/telegram';

/** Skip prep/buffer/travel events that mirror a real meeting */
const SKIP_PATTERNS = [/^📋\s*prep/i, /^prep:/i, /^travel/i, /^buffer/i, /^commute/i, /^focus\s*time/i];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Compute calendar density context for coaching tone adjustment.
 * E.g. "Meeting 3 of 7 today. Back-to-back — no gap before. 5.5 hours of meetings total."
 */
function computeCalendarDensity(
  events: { start: string; end: string }[],
  currentIndex: number,
): string {
  const total = events.length;
  const position = currentIndex + 1;

  // Total meeting hours
  const totalMinutes = events.reduce((sum, e) => {
    const start = new Date(e.start).getTime();
    const end = new Date(e.end).getTime();
    return sum + (end - start) / 60_000;
  }, 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  // Back-to-back detection (gap < 15 min)
  const current = events[currentIndex];
  const currentStart = new Date(current.start).getTime();
  const currentEnd = new Date(current.end).getTime();

  let backToBackBefore = false;
  let backToBackAfter = false;

  if (currentIndex > 0) {
    const prevEnd = new Date(events[currentIndex - 1].end).getTime();
    backToBackBefore = (currentStart - prevEnd) / 60_000 < 15;
  }
  if (currentIndex < events.length - 1) {
    const nextStart = new Date(events[currentIndex + 1].start).getTime();
    backToBackAfter = (nextStart - currentEnd) / 60_000 < 15;
  }

  const parts = [`Meeting ${position} of ${total} today.`];

  if (backToBackBefore && backToBackAfter) {
    parts.push('Back-to-back — no gap before or after.');
  } else if (backToBackBefore) {
    parts.push('Back-to-back — no gap before.');
  } else if (backToBackAfter) {
    parts.push('Back-to-back — no gap after.');
  }

  parts.push(`${totalHours} hours of meetings total.`);

  return parts.join(' ');
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Query only users who have connected Telegram
  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null } },
    select: { id: true, telegramChatId: true },
  });

  const now = new Date();
  const results: { userId: string; coached: number; reflections: number; error?: string }[] = [];

  for (const user of users) {
    let coached = 0;
    let reflections = 0;

    try {
      const userId = user.id;
      const chatId = user.telegramChatId!;

      // Skip users who need to reconnect their calendar
      if (await needsReconnect(userId)) continue;

      const events = await getTodayEvents(userId);
      const today = now.toISOString().slice(0, 10);

      // Per-user context (fetched once before event loop)
      const annotations = await getUserAnnotationHistory(userId);
      const acipProfile = await getACIPProfile(userId);
      const summaries = await getRecentSummaries(userId, 3);
      const intention = await getDailyIntention(userId, today);
      const annotationSummary = summarizeAnnotationPatterns(annotations);

      // Filter out prep/buffer events that mirror real meetings
      const coachableEvents = events.filter(
        (e) => !SKIP_PATTERNS.some((p) => p.test(e.title)),
      );

      for (let i = 0; i < coachableEvents.length; i++) {
        const event = coachableEvents[i];
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        const minsUntilStart = (eventStart.getTime() - now.getTime()) / 60_000;
        const minsSinceEnd = (now.getTime() - eventEnd.getTime()) / 60_000;

        // Pre-event coaching: events starting within the next 30 minutes
        if (minsUntilStart > 0 && minsUntilStart <= 30) {
          const scoringEvent = {
            id: event.id,
            summary: event.title,
            attendees: event.attendees,
            isRecurring: event.isRecurring,
            start: event.start,
          };

          const result = await scoreEventPersonalized(
            scoringEvent,
            annotations,
            acipProfile,
            annotationSummary,
          );

          // Lowered threshold: only skip truly low-stress events (score 1)
          if (result.score < 2) continue;

          const similar = findSimilarAnnotations(annotations, event.title);
          const calendarDensity = computeCalendarDensity(events, i);

          const content = await generateCoachingPrompt(
            event.title,
            result.pillar,
            event.attendees,
            {
              dailyIntention: intention ?? undefined,
              recentSummaries: summaries,
              pastRatingsForSimilar: similar,
              acipProfile,
              stressEstimate: result.score,
              calendarDensity,
            },
          );

          // Atomic dedup: try to claim this event in the DB first.
          // If another cron run already stored it, the unique constraint
          // on eventId will throw and we skip sending.
          try {
            await prisma.sentCoaching.create({
              data: {
                userId,
                eventId: event.id,
                eventTitle: event.title,
                pillar: result.pillar,
                content,
                channel: 'telegram',
              },
            });
          } catch {
            // Unique constraint violation → already sent by another run
            continue;
          }

          try {
            await sendCoachingPrompt(chatId, event.title, content);
            coached++;
          } catch (sendErr) {
            console.error(`Failed to send coaching to user ${userId}:`, sendErr);
          }
        }

        // Post-event reflection: events that ended within the last 10 minutes
        if (minsSinceEnd > 0 && minsSinceEnd <= 10) {
          // Atomic dedup: only send reflection if one hasn't been sent yet
          try {
            const updated = await prisma.sentCoaching.updateMany({
              where: { eventId: event.id, reflectionSentAt: null, responseScore: null },
              data: { reflectionSentAt: new Date() },
            });
            if (updated.count === 0) continue;
          } catch {
            continue;
          }

          try {
            const text = `How did <i>${escapeHtml(event.title)}</i> go? Reply 1-5`;
            await sendTelegramMessage(chatId, text, 'HTML');
            reflections++;
          } catch (reflErr) {
            console.error(`Failed to send reflection to user ${userId}:`, reflErr);
          }
        }
      }
    } catch (error) {
      console.error(`Cron error for user ${user.id}:`, error);
      results.push({ userId: user.id, coached, reflections, error: String(error) });
      continue;
    }

    results.push({ userId: user.id, coached, reflections });
  }

  return Response.json({ ok: true, results });
}
