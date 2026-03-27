import type { Pillar } from "./interventions";

export interface ScoringEvent {
  summary: string;
  attendees: string[];
  isRecurring: boolean;
}

const STRESS_KEYWORDS = [
  "review",
  "performance",
  "board",
  "all-hands",
  "allhands",
  "presentation",
  "demo",
  "interview",
  "evaluation",
  "assessment",
];

const INSIGHT_KEYWORDS = ["brainstorm", "creative", "ideation"];

/**
 * Score a calendar event on a 1-5 stress scale.
 *
 * Base score: 2
 * +1 if attendees > 5
 * +1 if summary contains a stress keyword
 * -1 if recurring AND attendees <= 2 (familiar 1:1)
 * Clamped to [1, 5].
 */
export function scoreEvent(event: ScoringEvent): number {
  let score = 2;

  if (event.attendees.length > 5) score += 1;

  const lower = event.summary.toLowerCase();
  if (STRESS_KEYWORDS.some((kw) => lower.includes(kw))) score += 1;

  if (event.isRecurring && event.attendees.length <= 2) score -= 1;

  return Math.max(1, Math.min(5, score));
}

/**
 * Select which ACIP pillar to use for coaching based on event characteristics.
 *
 * - Performance reviews, 1:1s, recurring meetings with <= 2 people -> 'connection'
 * - Attendees > 5 -> 'awareness'
 * - Brainstorm/creative/ideation in summary -> 'insight'
 * - Default -> 'awareness'
 */
export function selectPillar(event: ScoringEvent): Pillar {
  const lower = event.summary.toLowerCase();

  // Performance reviews or recurring small meetings -> connection
  if (STRESS_KEYWORDS.slice(0, 2).some((kw) => lower.includes(kw))) {
    return "connection";
  }
  if (event.isRecurring && event.attendees.length <= 2) {
    return "connection";
  }

  // Large group -> awareness
  if (event.attendees.length > 5) {
    return "awareness";
  }

  // Creative/brainstorm -> insight
  if (INSIGHT_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "insight";
  }

  return "awareness";
}

/** Static fallback prompts when Claude API is unavailable, 2 per pillar. */
export const FALLBACK_PROMPTS: Record<Pillar, string[]> = {
  awareness: [
    "Take three slow breaths before you begin.",
    "Notice your feet on the floor. Notice your hands. You are here.",
  ],
  connection: [
    "What does the other person need from this conversation?",
    "How might they be feeling right now? What would help them?",
  ],
  insight: [
    "What assumptions are you bringing to this? Are they true?",
    "What would you notice if you watched this situation from the outside?",
  ],
  purpose: [
    "What matters most to you in this conversation?",
    "How does this connect to what you care about?",
  ],
};
