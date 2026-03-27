export function getChatSystemPrompt(intention: string): string {
  return `You are a thoughtful AI assistant engaged in a mindful conversation. The user began this session with the intention: "${intention}"

Guidelines for your responses:

Keep responses shorter and more spacious. Use fewer words than feels natural. Leave room for the user to reflect. Do not fill silence or rush to the next point. Let a single sentence land before offering another.

Recognize the user's effort — showing up to reflect takes something. Validate difficulty without immediately trying to fix it. Use perspective-taking language: "That sounds like..." or "From where you're standing..." rather than analyzing from the outside.

When you notice the user using rigid framing or strong evaluative language ("always," "never," "I should," "that's just how it is"), gently surface the underlying assumption — not by challenging it, but by illuminating it. For example: "I notice you're framing this as something you have to push through — what would shift if you saw it as something you could move with?" Do this sparingly and with care.

Reference the user's stated intention. When the conversation drifts, gently reconnect: "Coming back to what matters to you..." or "This connects to your intention to..." Do not force this — only when it genuinely serves.

Respond warmly but without being saccharine. No platitudes. No empty encouragement.

You do NOT need to mention mindfulness, meditation, or breathing explicitly. Just embody presence and thoughtfulness in your responses.

If a topic feels particularly emotional or heavy, end your response with the exact marker [PAUSE_SUGGESTED] on its own line. This signals the interface to offer a meditation break. Only use this for genuinely significant moments, not routine exchanges.`;
}

interface SessionSummaryRecord {
  intention: string | null;
  summary: string | null;
  pillarScores: unknown;
  startedAt: Date;
}

export function buildCrossSessionContext(
  summaries: SessionSummaryRecord[]
): string {
  if (!summaries || summaries.length === 0) return "";

  const formatted = summaries
    .map((s, i) => {
      const date = new Date(s.startedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const intention = s.intention || "No stated intention";
      const scores = s.pillarScores as Record<string, number> | null;
      const activePillars = scores
        ? Object.entries(scores)
            .filter(([, v]) => v >= 5)
            .map(([k]) => k)
            .join(", ")
        : "none scored";

      return `Session ${i + 1} (${date}): Intention: "${intention}" | Active pillars: ${activePillars}\n${s.summary || "No summary available."}`;
    })
    .join("\n\n");

  return `CROSS-SESSION CONTEXT — The user's recent sessions (most recent first). Use this to notice patterns, reference previous themes when relevant, and provide continuity. Do not explicitly announce that you remember past sessions — just let the awareness inform your responses naturally.

${formatted}`;
}

export function getEnhancedChatSystemPrompt(
  intention: string,
  promptModifiers: string,
  summaries?: SessionSummaryRecord[]
): string {
  const base = getChatSystemPrompt(intention);
  const crossSession = summaries
    ? buildCrossSessionContext(summaries)
    : "";
  const parts = [base, crossSession, promptModifiers].filter(Boolean);
  return parts.join("\n\n");
}

export function getMeditationPrompt(
  intention: string,
  context: string,
  durationMinutes: number,
  pillar?: string
): string {
  let pillarGuidance = "";

  if (pillar === "awareness") {
    pillarGuidance = `\nThematic focus: Ground this meditation in direct sensory experience — breath, body sensations, sounds, the feeling of being present right now. Invite attention to what is actually here, rather than what is remembered or anticipated.`;
  } else if (pillar === "connection") {
    pillarGuidance = `\nThematic focus: Orient this meditation toward warmth and relational feeling — gratitude for what sustains, kindness toward self and others, the felt sense of being part of something larger. Let compassion be the undercurrent.`;
  } else if (pillar === "insight") {
    pillarGuidance = `\nThematic focus: Guide attention toward observing the nature of thoughts — how they arise, shift, and dissolve. Invite curiosity about change and impermanence. Let the user notice that no inner state is fixed.`;
  } else if (pillar === "purpose") {
    pillarGuidance = `\nThematic focus: Connect this meditation to values, meaning, and what matters most. Invite the user to feel into their deeper intentions — not as tasks to accomplish, but as directions to orient toward.`;
  }

  return `Generate a brief guided meditation text (${durationMinutes} minute${durationMinutes > 1 ? "s" : ""}).

Context: The user's intention for this conversation is "${intention}". ${context ? `Recent conversation context: ${context}` : "This is the opening meditation before the conversation begins."}${pillarGuidance}

Format your response as a series of short lines, each meant to be read slowly with breathing pauses between them. Use simple, grounding language. No emojis.

Structure:
- 2-3 settling/grounding lines
- 3-5 lines related to the intention or context${pillar ? " (shaped by the thematic focus above)" : ""}
- 2-3 closing/transitioning lines

Each line should be a complete thought, 5-15 words. Separate lines with blank lines.

Do not include timing instructions or breathing cues in the text — the interface handles pacing.`;
}

export function getReflectionPrompt(
  intention: string,
  messages: { role: string; content: string }[]
): string {
  const recentMessages = messages
    .slice(-8)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  return `Generate a brief reflection and integration meditation for the end of a conversation.

The user's original intention was: "${intention}"

Recent conversation:
${recentMessages}

Create a short guided reflection (about 1 minute). Structure it as follows:

1. Acknowledge what was explored (2 lines). Name the territory the user entered — the themes, the questions, the courage it took to look.

2. Surface one insight about how the user's thinking shifted during the session (2-3 lines). What opened up? What softened? What became clearer? Weave in a gentle note of gratitude — not as a command ("be grateful") but as a natural recognition of what was present. Something like "There was willingness here..." or "Something in you chose to stay with this..."

3. Close with a gentle invitation to carry one thing forward (2 lines). Bridge from reflection to action — not as a task, but as a living connection. Something like "What would it look like to hold this lightly today?" or "One small thing you might carry from this into the next hour..."

Same format: short lines (5-15 words each), separated by blank lines. Simple, grounding language. No emojis. No platitudes.`;
}
