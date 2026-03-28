import Anthropic from '@anthropic-ai/sdk';
import type { Pillar } from '@/lib/interventions';
import type { UserAnnotation } from '@/lib/companion';
import { FALLBACK_PROMPTS } from '@/lib/scoring';

const anthropic = new Anthropic();

export interface CoachingContext {
  dailyIntention?: string;
  recentSummaries?: {
    summary: string | null;
    pillarScores: unknown;
    intention: string | null;
  }[];
  pastRatingsForSimilar?: UserAnnotation[];
  acipProfile?: Record<Pillar, number>;
  stressEstimate?: number;
  calendarDensity?: string;
}

/**
 * Generate a one-sentence coaching prompt for a meeting using Claude,
 * enriched with user history, ACIP profile, and calendar density.
 * Falls back to a static prompt if the API call fails.
 */
export async function generateCoachingPrompt(
  eventTitle: string,
  pillar: Pillar,
  attendees: string[],
  context: CoachingContext = {},
): Promise<string> {
  const systemParts = [
    'You are a mindful coach. Generate ONE sentence for someone about to enter a meeting.',
    `Focus on the ${pillar} pillar.`,
  ];

  if (context.acipProfile) {
    const p = context.acipProfile;
    const strong = (Object.entries(p) as [Pillar, number][])
      .filter(([, v]) => v >= 7)
      .map(([k]) => k);
    const weak = (Object.entries(p) as [Pillar, number][])
      .filter(([, v]) => v <= 4)
      .map(([k]) => k);
    systemParts.push(
      `This person's well-being profile: ${strong.length > 0 ? `strong in ${strong.join(', ')}` : 'no strong pillars'}; ${weak.length > 0 ? `needs growth in ${weak.join(', ')}` : 'no weak pillars'}.`,
    );
  }

  if (context.recentSummaries && context.recentSummaries.length > 0) {
    const summaryTexts = context.recentSummaries
      .slice(0, 3)
      .filter((s) => s.summary)
      .map((s) => s.summary!.slice(0, 100));
    if (summaryTexts.length > 0) {
      systemParts.push(`Their recent sessions: ${summaryTexts.join(' | ')}`);
    }
  }

  if (context.dailyIntention) {
    systemParts.push(`Their intention today: "${context.dailyIntention}".`);
  }

  if (context.pastRatingsForSimilar && context.pastRatingsForSimilar.length > 0) {
    const avgPast =
      Math.round(
        (context.pastRatingsForSimilar.reduce((s, a) => s + a.stress, 0) /
          context.pastRatingsForSimilar.length) *
          10,
      ) / 10;
    systemParts.push(
      `They've rated similar events as ${avgPast}/5 stress in the past.`,
    );
  }

  if (context.stressEstimate) {
    systemParts.push(
      `Estimated stress for this event: ${context.stressEstimate}/5.`,
    );
  }

  if (context.calendarDensity) {
    systemParts.push(`Their day: ${context.calendarDensity}`);
  }

  systemParts.push('Be warm, specific, under 30 words. No greeting, no sign-off.');

  const attendeeContext =
    attendees.length > 0
      ? `The meeting has ${attendees.length} attendees.`
      : 'This is a solo event.';

  const userMessage = `Meeting: "${eventTitle}". ${attendeeContext}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6-20250627',
      max_tokens: 150,
      system: systemParts.join('\n'),
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
