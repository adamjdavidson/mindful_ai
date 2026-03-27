// lib/tourData.ts

export interface TourStop {
  id: string;
  selector: string;               // data-tour-id selector
  title: string;
  description: string;             // Layer 1: what it does
  science: string;                 // Layer 2: the research
  pillar: 'awareness' | 'connection' | 'insight' | 'purpose';
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  simulate?: boolean;              // whether this stop needs simulation
}

export const tourStops: TourStop[] = [
  {
    id: 'breathing-circle',
    selector: '[data-tour-id="breathing-circle"]',
    title: 'Breathing Animation',
    description: 'Anchors you with a gentle inhale-hold-exhale cycle when each session begins. The circles contract inward as you breathe in, expand outward as you breathe out.',
    science: 'This maps to the Awareness pillar. Focused attention on breathing engages the central-executive network while suppressing default-mode wandering. Even 3-5 seconds of breath awareness activates the same neural mechanisms as formal meditation practice. (Dahl et al., 2020 PNAS)',
    pillar: 'awareness',
    simulate: true,
  },
  {
    id: 'meditation-option',
    selector: '[data-tour-id="meditation-option"]',
    title: 'Guided Meditation',
    description: 'An optional settling period before you begin: 15 seconds, 40 seconds, or 1 minute. Skip it if you want. This is an invitation, not a requirement.',
    science: 'The Healthy Minds Program RCT found that even 102 total minutes of practice across 8 weeks produced significant stress reduction. Brief practices accumulate. The option to skip is intentional: forced mindfulness backfires. (Goldberg et al., HMP-RCT)',
    pillar: 'awareness',
    simulate: true,
  },
  {
    id: 'intention-setting',
    selector: '[data-tour-id="intention-setting"]',
    title: 'Setting an Intention',
    description: "Name what you're here for before the conversation starts. This anchors the session and gives the AI a reference point to gently bring you back when the conversation drifts.",
    science: "This maps to the Purpose pillar. Clarity about values and direction is one of four trainable dimensions of well-being. Setting an intention activates goal-directed prefrontal networks and creates a self-referential anchor that supports sustained attention. (Davidson & Dahl, 2026)",
    pillar: 'purpose',
    simulate: true,
  },
  {
    id: 'pillar-tint',
    selector: '[data-tour-id="pillar-tint"]',
    title: 'Background Color Shifts',
    description: "The background subtly tints during your conversation: blue for awareness, rose for connection, violet for insight, amber for purpose. Most people don't consciously notice. That's the point.",
    science: "Peripheral sensory input is integrated by the brain without requiring conscious attention. Subliminal color exposure influences mood and cognitive processing (Meier et al., 2004). The 7% opacity ensures the signal stays below the threshold of distraction while still being neurologically processed.",
    pillar: 'awareness',
    simulate: true,
  },
  {
    id: 'self-report',
    selector: '[data-tour-id="self-report"]',
    title: 'Presence Dots',
    description: 'Five dots in the bottom-left. Rate how present you feel, from scattered to focused. Always here, never required. Click to note your state at any time.',
    science: 'This maps to the Awareness pillar. Meta-awareness (noticing your own mental state) is the core mechanism identified in contemplative science research. Simply labeling your state activates the dorsolateral prefrontal cortex and reduces default-mode network wandering. (Dahl et al., 2020 PNAS)',
    pillar: 'awareness',
  },
  {
    id: 'mindful-overlay',
    selector: '[data-tour-id="mindful-overlay"]',
    title: 'Mindful Prompts',
    description: 'Gentle questions appear in the bottom-right every few exchanges: "What are you noticing right now?" They fade away on their own. You can ignore them completely.',
    science: "These activate open monitoring, a form of awareness where you observe your experience without directing it. This engages the anterior insula and anterior cingulate cortex. The auto-dismiss design respects autonomy: forced reflection produces resistance, not insight. (PNAS-2020, CS-2015)",
    pillar: 'insight',
    simulate: true,
  },
  {
    id: 'ai-response',
    selector: '[data-tour-id="ai-response"]',
    title: 'Compassionate AI Responses',
    description: "The AI recognizes your effort, validates difficulty, and gently surfaces assumptions. It references your intention when the conversation drifts. None of this is announced. It just happens.",
    science: "This maps to the Connection pillar. The AI models compassionate communication so you absorb the pattern through interaction, the same way you absorb communication styles from people you spend time with. Prosocial reappraisal engages the temporoparietal junction. (Dahl et al., 2020 PNAS)",
    pillar: 'connection',
    simulate: true,
  },
  {
    id: 'session-closing',
    selector: '[data-tour-id="session-closing"]',
    title: 'Session Closing',
    description: "When you end a session, there's a brief reflection, a moment of gratitude, and an invitation to name one thing you'll carry forward. Then: \"Thank you for being present.\"",
    science: "Gratitude practices show altered functional connectivity in the insula, amygdala, and reward regions (HMP-RCT). The closing bridges the Purpose pillar: naming one concrete action creates an intention-action link that extends the session's benefits into daily life. (Davidson & Dahl, 2026)",
    pillar: 'purpose',
    simulate: true,
  },
];
