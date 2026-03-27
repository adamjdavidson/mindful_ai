export type Pillar = "awareness" | "connection" | "insight" | "purpose";
export type PillarTint = "blue" | "rose" | "violet" | "amber" | "neutral";

export interface Intervention {
  id: number;
  name: string;
  pillar: Pillar;
  tint: PillarTint;
  type: "overlay" | "prompt" | "pacing" | "color";
  content: string;
}

export interface SessionState {
  exchangeCount: number;
  lastMessageTimestamp: number;
  recentMessageTimestamps: number[]; // last 5 message timestamps
  phase: "arrival" | "conversation" | "reflection" | "closing";
  intention: string;
  activeInterventions: number[]; // IDs of currently active interventions
}

// Tunable constants
const CHECKPOINT_INTERVAL = 4;
const INSIGHT_CHECKPOINT_INTERVAL = 8;
const IDLE_THRESHOLD_MS = 45_000;
const RAPID_FIRE_COUNT = 3;
const RAPID_FIRE_WINDOW_MS = 60_000;
const SESSION_DURATION_THRESHOLD_MS = 20 * 60_000;

// ---------------------------------------------------------------------------
// The 8 micro-interventions
// ---------------------------------------------------------------------------

const INTERVENTIONS: Intervention[] = [
  {
    id: 1,
    name: "Breath-Anchored Pacing",
    pillar: "awareness",
    tint: "blue",
    type: "pacing",
    content: "",
  },
  {
    id: 2,
    name: "Meta-Awareness Pause",
    pillar: "awareness",
    tint: "blue",
    type: "overlay",
    content: "What are you noticing right now?",
  },
  {
    id: 3,
    name: "Compassionate Mirroring",
    pillar: "connection",
    tint: "rose",
    type: "prompt",
    content:
      "In your responses, model compassion: recognize the user's effort and intention, validate difficulty without fixing, use perspective-taking language. When the user expresses frustration or self-criticism, respond with extra warmth.",
  },
  {
    id: 4,
    name: "Gratitude Micro-Prompt",
    pillar: "connection",
    tint: "rose",
    type: "overlay",
    content: "What from this conversation are you grateful for?",
  },
  {
    id: 5,
    name: "Assumption Surfacing",
    pillar: "insight",
    tint: "violet",
    type: "prompt",
    content:
      "When the user expresses rigid framing, strong evaluative language, or catastrophizing, gently make the underlying assumption visible. Not by challenging — by illuminating. For example: 'I notice you're framing this as X — what would shift if you saw it as Y?'",
  },
  {
    id: 6,
    name: "Impermanence Noticing",
    pillar: "insight",
    tint: "violet",
    type: "overlay",
    content: "How has your thinking about this changed?",
  },
  {
    id: 7,
    name: "Intention as Purpose Anchor",
    pillar: "purpose",
    tint: "amber",
    type: "prompt",
    content:
      "The user's intention for this session is: '{intention}'. Gently reconnect to this intention when the conversation drifts significantly. Use phrases like 'Coming back to what matters to you...' or 'This connects to your intention to...'",
  },
  {
    id: 8,
    name: "Values-Action Bridge",
    pillar: "purpose",
    tint: "amber",
    type: "overlay",
    content: "What's one thing you'll do differently?",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function pillarToTint(pillar: Pillar): PillarTint {
  const map: Record<Pillar, PillarTint> = {
    awareness: "blue",
    connection: "rose",
    insight: "violet",
    purpose: "amber",
  };
  return map[pillar];
}

export function isRapidFire(timestamps: number[]): boolean {
  if (timestamps.length < RAPID_FIRE_COUNT) return false;
  const sorted = [...timestamps].sort((a, b) => a - b);
  // Check if any window of RAPID_FIRE_COUNT consecutive messages fits within the window
  for (let i = 0; i <= sorted.length - RAPID_FIRE_COUNT; i++) {
    if (sorted[i + RAPID_FIRE_COUNT - 1] - sorted[i] <= RAPID_FIRE_WINDOW_MS) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Core engine functions
// ---------------------------------------------------------------------------

export function getActiveInterventions(state: SessionState): Intervention[] {
  const active: Intervention[] = [];

  // 1. Breath-Anchored Pacing — active when rapid-fire detected
  if (isRapidFire(state.recentMessageTimestamps)) {
    active.push(INTERVENTIONS[0]);
  }

  // 2. Meta-Awareness Pause — every CHECKPOINT_INTERVAL exchanges
  //    BUT NOT when impermanence noticing also fires (strict alternation)
  //    Exchange 4: awareness, 8: insight, 12: awareness, 16: insight...
  if (
    state.exchangeCount > 0 &&
    state.exchangeCount % CHECKPOINT_INTERVAL === 0 &&
    state.exchangeCount % INSIGHT_CHECKPOINT_INTERVAL !== 0
  ) {
    active.push(INTERVENTIONS[1]);
  }

  // 3. Compassionate Mirroring — always active during conversation phase
  if (state.phase === "conversation") {
    active.push(INTERVENTIONS[2]);
  }

  // 4. Gratitude Micro-Prompt — during reflection phase
  if (state.phase === "reflection") {
    active.push(INTERVENTIONS[3]);
  }

  // 5. Assumption Surfacing — active during conversation (handled via prompt)
  if (state.phase === "conversation") {
    active.push(INTERVENTIONS[4]);
  }

  // 6. Impermanence Noticing — every INSIGHT_CHECKPOINT_INTERVAL exchanges
  if (
    state.exchangeCount > 0 &&
    state.exchangeCount % INSIGHT_CHECKPOINT_INTERVAL === 0
  ) {
    active.push(INTERVENTIONS[5]);
  }

  // 7. Intention as Purpose Anchor — always active when intention is set
  if (state.intention) {
    active.push(INTERVENTIONS[6]);
  }

  // 8. Values-Action Bridge — during reflection phase, after gratitude
  //    (shown when gratitude is also active, i.e. reflection phase)
  if (
    state.phase === "reflection" &&
    state.activeInterventions.includes(4) // gratitude was already shown
  ) {
    active.push(INTERVENTIONS[7]);
  }

  return active;
}

export function shouldShowOverlay(state: SessionState): Intervention | null {
  const active = getActiveInterventions(state);
  const overlays = active.filter((i) => i.type === "overlay");
  if (overlays.length === 0) return null;

  // Priority: show the first overlay found (ordered by intervention id)
  // Impermanence Noticing at exchange 8 takes priority over Meta-Awareness
  // at the same checkpoint since it is more specific.
  // At exchange multiples of both (e.g. 8, 16, 24), prefer impermanence.
  const impermanence = overlays.find((i) => i.id === 6);
  if (impermanence) return impermanence;

  return overlays[0];
}

export function getPromptModifiers(state: SessionState): string {
  const active = getActiveInterventions(state);
  const promptInterventions = active.filter((i) => i.type === "prompt");

  const parts: string[] = promptInterventions.map((intervention) => {
    if (intervention.id === 7) {
      // Intention anchor — substitute the user's intention
      return intervention.content.replace("{intention}", state.intention);
    }
    return intervention.content;
  });

  return parts.join("\n\n");
}

export function getActiveTint(state: SessionState): PillarTint {
  // Check overlay first (highest priority)
  const overlay = shouldShowOverlay(state);
  if (overlay) return overlay.tint;

  // Then check prompt-type interventions
  const active = getActiveInterventions(state);
  const promptIntervention = active.find((i) => i.type === "prompt");
  if (promptIntervention) return promptIntervention.tint;

  return "neutral";
}

export function getPacingMultiplier(state: SessionState): number {
  if (isRapidFire(state.recentMessageTimestamps)) {
    return 0.6;
  }
  return 1.0;
}
