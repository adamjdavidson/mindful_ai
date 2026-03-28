import Anthropic from '@anthropic-ai/sdk';
import type { Pillar } from './interventions';
import type { UserAnnotation } from './companion';

const anthropic = new Anthropic();

export interface ScoringEvent {
  id: string;
  summary: string;
  attendees: string[];
  isRecurring: boolean;
  start: string;
}

export interface ScoringResult {
  score: number; // 1-5
  pillar: Pillar;
  source: 'user-exact' | 'user-similar' | 'claude-estimate' | 'default';
}

/** Static fallback prompts when Claude API is unavailable, 2 per pillar. */
export const FALLBACK_PROMPTS: Record<Pillar, string[]> = {
  awareness: [
    'Take three slow breaths before you begin.',
    'Notice your feet on the floor. Notice your hands. You are here.',
  ],
  connection: [
    'What does the other person need from this conversation?',
    'How might they be feeling right now? What would help them?',
  ],
  insight: [
    'What assumptions are you bringing to this? Are they true?',
    'What would you notice if you watched this situation from the outside?',
  ],
  purpose: [
    'What matters most to you in this conversation?',
    'How does this connect to what you care about?',
  ],
};

/**
 * Three-tier personalized scoring cascade:
 *   Tier 1 — Exact match (user rated this event ID before)
 *   Tier 2 — Title similarity (user rated events with same/similar title)
 *   Tier 3 — Claude estimation (with user context)
 *   Fallback — score 3 / awareness / default
 */
export async function scoreEventPersonalized(
  event: ScoringEvent,
  annotations: Record<string, UserAnnotation>,
  acipProfile: Record<Pillar, number>,
  annotationSummary: string,
): Promise<ScoringResult> {
  // Tier 1: Exact match by event ID
  if (annotations[event.id]) {
    return {
      score: annotations[event.id].stress,
      pillar: selectPillarFromProfile(acipProfile, event),
      source: 'user-exact',
    };
  }

  // Tier 2: Title similarity
  const normalized = event.summary.toLowerCase().trim();
  const similar = Object.values(annotations).filter((a) => {
    const t = a.title.toLowerCase().trim();
    return t === normalized || t.includes(normalized) || normalized.includes(t);
  });

  if (similar.length > 0) {
    const avgStress =
      Math.round(
        (similar.reduce((sum, a) => sum + a.stress, 0) / similar.length) * 10,
      ) / 10;
    return {
      score: Math.round(avgStress),
      pillar: selectPillarFromProfile(acipProfile, event),
      source: 'user-similar',
    };
  }

  // Tier 3: Claude estimation
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6-20250627',
      max_tokens: 200,
      system:
        'You are a stress estimation assistant. Given a calendar event and the user\'s history, estimate how stressful this event is likely to be on a 1-5 scale and recommend one of the four well-being pillars (awareness, connection, insight, purpose). Return ONLY valid JSON: {"score": N, "pillar": "...", "reasoning": "..."}',
      messages: [
        {
          role: 'user',
          content: [
            `Event: "${event.summary}"`,
            `Attendees: ${event.attendees.length}`,
            `Recurring: ${event.isRecurring}`,
            `Start: ${event.start}`,
            ``,
            `User's annotation history: ${annotationSummary}`,
            `User's well-being profile: awareness=${acipProfile.awareness}, connection=${acipProfile.connection}, insight=${acipProfile.insight}, purpose=${acipProfile.purpose}`,
            ``,
            `Estimate stress (1-5) and recommend the most relevant pillar.`,
          ].join('\n'),
        },
      ],
    });

    const block = response.content[0];
    if (block.type === 'text') {
      const parsed = JSON.parse(block.text);
      const score = Math.max(1, Math.min(5, Math.round(parsed.score)));
      const pillar = validatePillar(parsed.pillar);
      return { score, pillar, source: 'claude-estimate' };
    }
  } catch (error) {
    console.error('Claude scoring estimation failed:', error);
  }

  // Fallback
  return { score: 3, pillar: 'awareness', source: 'default' };
}

/**
 * Select pillar based on user's ACIP profile — pick the weakest pillar,
 * breaking ties with event context.
 */
function selectPillarFromProfile(
  acipProfile: Record<Pillar, number>,
  event: ScoringEvent,
): Pillar {
  const pillars: Pillar[] = ['awareness', 'connection', 'insight', 'purpose'];
  const sorted = pillars.sort((a, b) => acipProfile[a] - acipProfile[b]);

  // If clear winner (lowest score), use it
  if (acipProfile[sorted[0]] < acipProfile[sorted[1]]) {
    return sorted[0];
  }

  // Tie-break with event context
  if (event.attendees.length <= 2) return 'connection';
  if (event.attendees.length > 5) return 'awareness';

  return sorted[0];
}

function validatePillar(value: string): Pillar {
  const valid: Pillar[] = ['awareness', 'connection', 'insight', 'purpose'];
  if (valid.includes(value as Pillar)) return value as Pillar;
  return 'awareness';
}
