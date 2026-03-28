import { getTodayEvents } from '@/lib/google-calendar';
import {
  getUserAnnotationHistory,
  getACIPProfile,
  summarizeAnnotationPatterns,
  findSimilarAnnotations,
  getDailyIntention,
} from '@/lib/companion';
import { getRecentSummaries } from '@/lib/chat-persistence';
import { scoreEventPersonalized } from '@/lib/scoring';
import { generateCoachingPrompt } from '@/lib/coaching';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Send a plain text (or HTML/Markdown) message to a Telegram chat.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode?: "HTML" | "MarkdownV2",
): Promise<void> {
  const body: Record<string, string> = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;

  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram sendMessage failed:", err);
  }
}

/**
 * Send a coaching prompt formatted with the event name bold and the
 * coaching prompt in italic.  Uses HTML parse mode.
 */
export async function sendCoachingPrompt(
  chatId: string,
  eventName: string,
  prompt: string,
): Promise<void> {
  const text = `<b>${escapeHtml(eventName)}</b>\n<i>${escapeHtml(prompt)}</i>`;
  await sendTelegramMessage(chatId, text, "HTML");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Try to send a real coaching prompt for the user's next upcoming event.
 * Falls back to a warm confirmation message if no events or any error.
 * Used by both the webhook (on connect) and the test endpoint.
 */
export async function sendTestCoachingMessage(
  userId: string,
  chatId: string,
): Promise<{ sent: boolean; type: 'coaching' | 'fallback' }> {
  const FALLBACK_MSG =
    "You\u2019re all set! You\u2019ll receive a mindful coaching prompt before each meeting on your calendar.";

  try {
    const events = await getTodayEvents(userId);
    const now = new Date();

    // Find the next upcoming event (start time > now)
    const upcoming = events
      .filter((e) => new Date(e.start).getTime() > now.getTime())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    if (upcoming.length === 0) {
      await sendTelegramMessage(chatId, FALLBACK_MSG);
      return { sent: true, type: 'fallback' };
    }

    const event = upcoming[0];
    const today = now.toISOString().slice(0, 10);

    // Gather user context
    const annotations = await getUserAnnotationHistory(userId);
    const acipProfile = await getACIPProfile(userId);
    const summaries = await getRecentSummaries(userId, 3);
    const intention = await getDailyIntention(userId, today);
    const annotationSummary = summarizeAnnotationPatterns(annotations);

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

    const similar = findSimilarAnnotations(annotations, event.title);

    // Compute simple calendar density for context
    const position = upcoming.indexOf(event) + 1;
    const calendarDensity = `Meeting ${position} of ${events.length} today.`;

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

    await sendCoachingPrompt(chatId, event.title, content);
    return { sent: true, type: 'coaching' };
  } catch (error) {
    console.error('sendTestCoachingMessage failed, sending fallback:', error);
    try {
      await sendTelegramMessage(chatId, FALLBACK_MSG);
    } catch {
      // even fallback failed
    }
    return { sent: true, type: 'fallback' };
  }
}
