import { getDayCoachings, storeReflection } from '@/lib/companion';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body?.message;

    if (!message?.chat?.id || !message?.text) {
      return Response.json({ ok: true });
    }

    // Validate the message is from our configured chat
    const expectedChatId = process.env.TELEGRAM_CHAT_ID;
    if (String(message.chat.id) !== expectedChatId) {
      return Response.json({ ok: true });
    }

    // Parse the reply as a number 1-5
    const score = parseInt(message.text.trim(), 10);
    if (isNaN(score) || score < 1 || score > 5) {
      return Response.json({ ok: true });
    }

    // Find the most recent un-reflected coaching record for today
    const today = new Date().toISOString().slice(0, 10);
    const coachings = await getDayCoachings(today);

    const unreflected = coachings
      .filter((c) => !c.responseScore)
      .pop(); // most recent (last in list)

    if (unreflected) {
      await storeReflection(unreflected.eventId, score);
    }
  } catch (error) {
    console.error('Telegram webhook error:', error);
  }

  // Always return ok to prevent Telegram retries
  return Response.json({ ok: true });
}
