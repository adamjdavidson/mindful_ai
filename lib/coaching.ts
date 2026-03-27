import Anthropic from '@anthropic-ai/sdk';
import type { Pillar } from '@/lib/interventions';
import { FALLBACK_PROMPTS } from '@/lib/scoring';

const anthropic = new Anthropic();

/**
 * Generate a one-sentence coaching prompt for a meeting using Claude.
 * Falls back to a static prompt if the API call fails.
 */
export async function generateCoachingPrompt(
  eventTitle: string,
  pillar: Pillar,
  attendees: string[],
  dailyIntention?: string,
): Promise<string> {
  const attendeeContext =
    attendees.length > 0
      ? `The meeting has ${attendees.length} attendees.`
      : 'This is a solo event.';

  const intentionContext = dailyIntention
    ? `Their intention for the day is: "${dailyIntention}".`
    : '';

  const userMessage = [
    `Meeting: "${eventTitle}".`,
    attendeeContext,
    intentionContext,
  ]
    .filter(Boolean)
    .join(' ');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      system: `You are a gentle mindfulness coach. Generate ONE sentence of coaching for someone about to enter a meeting. Focus on the ${pillar} pillar of well-being. Be warm, specific, non-judgmental. No greeting, no sign-off. Maximum 25 words.`,
      messages: [{ role: 'user', content: userMessage }],
    });

    const block = response.content[0];
    if (block.type === 'text' && block.text.trim()) {
      return block.text.trim();
    }

    return pickFallback(pillar);
  } catch (error) {
    console.error('Coaching prompt generation failed:', error);
    return pickFallback(pillar);
  }
}

function pickFallback(pillar: Pillar): string {
  const prompts = FALLBACK_PROMPTS[pillar];
  return prompts[Math.floor(Math.random() * prompts.length)];
}
