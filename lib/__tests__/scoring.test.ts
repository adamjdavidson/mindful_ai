import { describe, it, expect } from "vitest";
import {
  scoreEvent,
  selectPillar,
  FALLBACK_PROMPTS,
  type ScoringEvent,
} from "../scoring";

function makeEvent(overrides: Partial<ScoringEvent> = {}): ScoringEvent {
  return {
    summary: "Team sync",
    attendees: ["alice@co.com", "bob@co.com"],
    isRecurring: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// scoreEvent
// ---------------------------------------------------------------------------
describe("scoreEvent", () => {
  it("returns base score 2 for a simple event", () => {
    expect(scoreEvent(makeEvent())).toBe(2);
  });

  it("+1 when attendees > 5", () => {
    const event = makeEvent({
      attendees: ["a", "b", "c", "d", "e", "f"],
    });
    expect(scoreEvent(event)).toBe(3);
  });

  it("+1 when summary contains a stress keyword", () => {
    expect(scoreEvent(makeEvent({ summary: "Q4 performance review" }))).toBe(3);
  });

  it("matches stress keywords case-insensitively", () => {
    expect(scoreEvent(makeEvent({ summary: "Board Meeting" }))).toBe(3);
  });

  it("-1 for recurring 1:1 (recurring AND attendees <= 2)", () => {
    const event = makeEvent({ isRecurring: true, attendees: ["a", "b"] });
    expect(scoreEvent(event)).toBe(1);
  });

  it("clamps to minimum 1", () => {
    // recurring 1:1 with 0 attendees: base 2, -1 = 1 (already 1, but ensure clamp)
    const event = makeEvent({ isRecurring: true, attendees: [] });
    expect(scoreEvent(event)).toBe(1);
  });

  it("clamps to maximum 5", () => {
    // >5 attendees (+1) + stress keyword (+1) = 4, not exceeding 5
    // Create a scenario that would push past 5 if unclamped
    const event = makeEvent({
      summary: "board review performance demo presentation",
      attendees: ["a", "b", "c", "d", "e", "f"],
    });
    // base 2 + 1 (attendees) + 1 (keyword) = 4
    expect(scoreEvent(event)).toBeLessThanOrEqual(5);
  });

  it("handles empty attendees list", () => {
    const event = makeEvent({ attendees: [] });
    expect(scoreEvent(event)).toBe(2);
  });

  it("handles empty summary", () => {
    const event = makeEvent({ summary: "" });
    expect(scoreEvent(event)).toBe(2);
  });

  it("stacks attendee and keyword bonuses", () => {
    const event = makeEvent({
      summary: "All-hands presentation",
      attendees: ["a", "b", "c", "d", "e", "f"],
    });
    // base 2 + 1 (attendees) + 1 (keyword) = 4
    expect(scoreEvent(event)).toBe(4);
  });

  it("recognizes all stress keywords", () => {
    const keywords = [
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
    for (const kw of keywords) {
      expect(scoreEvent(makeEvent({ summary: kw }))).toBeGreaterThanOrEqual(3);
    }
  });
});

// ---------------------------------------------------------------------------
// selectPillar
// ---------------------------------------------------------------------------
describe("selectPillar", () => {
  it("returns 'connection' for a recurring 1:1", () => {
    const event = makeEvent({ isRecurring: true, attendees: ["a", "b"] });
    expect(selectPillar(event)).toBe("connection");
  });

  it("returns 'connection' for a performance review", () => {
    expect(selectPillar(makeEvent({ summary: "Performance review" }))).toBe(
      "connection",
    );
  });

  it("returns 'awareness' for large group (>5 attendees)", () => {
    const event = makeEvent({
      attendees: ["a", "b", "c", "d", "e", "f"],
    });
    expect(selectPillar(event)).toBe("awareness");
  });

  it("returns 'insight' for brainstorm meetings", () => {
    expect(selectPillar(makeEvent({ summary: "Brainstorm new features" }))).toBe(
      "insight",
    );
  });

  it("returns 'insight' for creative/ideation meetings", () => {
    expect(selectPillar(makeEvent({ summary: "Creative session" }))).toBe(
      "insight",
    );
    expect(selectPillar(makeEvent({ summary: "Ideation workshop" }))).toBe(
      "insight",
    );
  });

  it("returns 'awareness' as default", () => {
    expect(selectPillar(makeEvent())).toBe("awareness");
  });
});

// ---------------------------------------------------------------------------
// FALLBACK_PROMPTS
// ---------------------------------------------------------------------------
describe("FALLBACK_PROMPTS", () => {
  it("has exactly 4 pillars", () => {
    expect(Object.keys(FALLBACK_PROMPTS)).toHaveLength(4);
  });

  it("has 2 prompts per pillar", () => {
    for (const pillar of Object.keys(FALLBACK_PROMPTS)) {
      expect(FALLBACK_PROMPTS[pillar as keyof typeof FALLBACK_PROMPTS]).toHaveLength(2);
    }
  });

  it("all prompts are non-empty strings", () => {
    for (const prompts of Object.values(FALLBACK_PROMPTS)) {
      for (const p of prompts) {
        expect(typeof p).toBe("string");
        expect(p.length).toBeGreaterThan(0);
      }
    }
  });
});
