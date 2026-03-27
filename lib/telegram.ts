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
