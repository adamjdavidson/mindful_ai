import { prisma } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { getDayCoachings, storeReflection } from "@/lib/companion";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body?.message;

    if (!message?.chat?.id || !message?.text) {
      return Response.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = (message.text as string).trim();

    // ── Deep-link: /start {userId} ──────────────────────────────────
    if (text.startsWith("/start")) {
      const userId = text.split(" ")[1];
      if (!userId) {
        await sendTelegramMessage(
          chatId,
          "Welcome! Open the Mindful AI settings page to connect your account.",
        );
        return Response.json({ ok: true });
      }

      // Verify user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        await sendTelegramMessage(
          chatId,
          "Could not find your account. Please try the link from Settings again.",
        );
        return Response.json({ ok: true });
      }

      // Store the chatId on the user record
      await prisma.user.update({
        where: { id: userId },
        data: { telegramChatId: chatId },
      });

      await sendTelegramMessage(
        chatId,
        `Connected! Hi ${user.name ?? "there"} \u2014 you\u2019ll receive mindful coaching prompts here before your calendar events.\n\nReply with a number 1\u20135 after each event to log how it went.`,
      );

      return Response.json({ ok: true });
    }

    // ── Numeric reply (1-5): store reflection ───────────────────────
    const score = parseInt(text, 10);
    if (!isNaN(score) && score >= 1 && score <= 5) {
      // Find user by chatId
      const user = await prisma.user.findFirst({
        where: { telegramChatId: chatId },
      });

      if (!user) {
        return Response.json({ ok: true });
      }

      const today = new Date().toISOString().slice(0, 10);
      const coachings = await getDayCoachings(today);

      const unreflected = coachings
        .filter((c) => !c.responseScore)
        .pop();

      if (unreflected) {
        await storeReflection(unreflected.eventId, score);
        await sendTelegramMessage(chatId, `Noted \u2014 ${score}/5. Thank you.`);
      }

      return Response.json({ ok: true });
    }
  } catch (error) {
    console.error("Telegram webhook error:", error);
  }

  // Always return ok to prevent Telegram retries
  return Response.json({ ok: true });
}
