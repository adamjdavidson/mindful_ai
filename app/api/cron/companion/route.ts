import { NextRequest } from 'next/server';
import {
  getAllUserIds,
  getCoachingForEvent,
  storeCoaching,
  getDailyIntention,
  needsReconnect,
} from '@/lib/companion';
import { getTodayEvents } from '@/lib/google-calendar';
import { scoreEvent, selectPillar } from '@/lib/scoring';
import { generateCoachingPrompt } from '@/lib/coaching';
import { sendTelegram, sendReflectionRequest } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userIds = await getAllUserIds();
  const now = new Date();
  const results: { userId: string; coached: number; reflections: number }[] = [];

  for (const userId of userIds) {
    let coached = 0;
    let reflections = 0;

    try {
      // Skip users who need to reconnect their calendar
      if (await needsReconnect(userId)) continue;

      const events = await getTodayEvents(userId);
      const today = now.toISOString().slice(0, 10);
      const intention = await getDailyIntention(userId, today);

      for (const event of events) {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        const minsUntilStart = (eventStart.getTime() - now.getTime()) / 60_000;
        const minsSinceEnd = (now.getTime() - eventEnd.getTime()) / 60_000;

        // Pre-event coaching: events starting within the next 30 minutes
        if (minsUntilStart > 0 && minsUntilStart <= 30) {
          const scoringEvent = {
            summary: event.title,
            attendees: event.attendees,
            isRecurring: event.isRecurring,
          };

          const score = scoreEvent(scoringEvent);
          if (score < 3) continue;

          // Dedup: skip if already coached for this event
          const existing = await getCoachingForEvent(event.id);
          if (existing) continue;

          const pillar = selectPillar(scoringEvent);
          const content = await generateCoachingPrompt(
            event.title,
            pillar,
            event.attendees,
            intention ?? undefined,
          );

          const sent = await sendTelegram({
            eventTitle: event.title,
            coachingPrompt: content,
            pillar,
          });

          if (sent) {
            await storeCoaching({
              id: `${event.id}-${Date.now()}`,
              eventId: event.id,
              pillar,
              content,
              sentAt: now.toISOString(),
              channel: 'telegram',
            });
            coached++;
          }
        }

        // Post-event reflection: events that ended within the last 10 minutes
        if (minsSinceEnd > 0 && minsSinceEnd <= 10) {
          const existing = await getCoachingForEvent(event.id);
          if (existing && !existing.responseScore) {
            await sendReflectionRequest(event.title);
            reflections++;
          }
        }
      }
    } catch (error) {
      console.error(`Cron error for user ${userId}:`, error);
    }

    results.push({ userId, coached, reflections });
  }

  return Response.json({ ok: true, results });
}
