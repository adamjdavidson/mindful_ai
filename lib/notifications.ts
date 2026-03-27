import type { Pillar } from '@/lib/interventions';

export interface NotificationPayload {
  eventTitle: string;
  coachingPrompt: string;
  pillar: Pillar;
  practiceLink?: string;
}

const PILLAR_EMOJI: Record<Pillar, string> = {
  awareness: '\u{1F535}',  // blue circle
  connection: '\u{1F339}', // rose
  insight: '\u{1F7E3}',    // purple circle
  purpose: '\u{1F7E1}',    // yellow circle
};

/**
 * Send a coaching notification via Telegram Bot API.
 * Returns true on success, false on failure.
 */
export async function sendTelegram(
  payload: NotificationPayload,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('Telegram credentials not configured');
    return false;
  }

  const emoji = PILLAR_EMOJI[payload.pillar];

  let text = `${emoji} <b>${escapeHtml(payload.eventTitle)}</b>\n\n`;
  text += `<i>${escapeHtml(payload.coachingPrompt)}</i>`;

  if (payload.practiceLink) {
    text += `\n\n<a href="${escapeHtml(payload.practiceLink)}">Open practice</a>`;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      },
    );

    if (!response.ok) {
      console.error('Telegram API error:', response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telegram send failed:', error);
    return false;
  }
}

/**
 * Send a post-event reflection request via Telegram.
 */
export async function sendReflectionRequest(
  eventTitle: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('Telegram credentials not configured');
    return false;
  }

  const text = `How did <i>${escapeHtml(eventTitle)}</i> go? Reply 1-5`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      },
    );

    return response.ok;
  } catch (error) {
    console.error('Telegram reflection request failed:', error);
    return false;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
