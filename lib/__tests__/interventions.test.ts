import { describe, it, expect } from "vitest";
import {
  isRapidFire,
  getActiveInterventions,
  shouldShowOverlay,
  getPromptModifiers,
  getActiveTint,
  getPacingMultiplier,
  type SessionState,
} from "../interventions";

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    exchangeCount: 0,
    lastMessageTimestamp: Date.now(),
    recentMessageTimestamps: [],
    phase: "conversation",
    intention: "",
    activeInterventions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isRapidFire
// ---------------------------------------------------------------------------
describe("isRapidFire", () => {
  it("returns true for 3 messages within 60s", () => {
    const now = Date.now();
    expect(isRapidFire([now, now + 10_000, now + 20_000])).toBe(true);
  });

  it("returns false for only 2 messages", () => {
    const now = Date.now();
    expect(isRapidFire([now, now + 5_000])).toBe(false);
  });

  it("returns false for 3 messages outside 60s window", () => {
    const now = Date.now();
    expect(isRapidFire([now, now + 61_000, now + 122_000])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(isRapidFire([])).toBe(false);
  });

  it("returns true when exactly at boundary (60000ms apart)", () => {
    const now = Date.now();
    // 3 messages: first at now, last at now + 60000  (difference === 60000, <= passes)
    expect(isRapidFire([now, now + 30_000, now + 60_000])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getActiveInterventions
// ---------------------------------------------------------------------------
describe("getActiveInterventions", () => {
  it("phase=conversation includes compassionate mirroring (id=3) and assumption surfacing (id=5)", () => {
    const state = makeState({ phase: "conversation" });
    const ids = getActiveInterventions(state).map((i) => i.id);
    expect(ids).toContain(3);
    expect(ids).toContain(5);
  });

  it("phase=reflection includes gratitude (id=4)", () => {
    const state = makeState({ phase: "reflection" });
    const ids = getActiveInterventions(state).map((i) => i.id);
    expect(ids).toContain(4);
  });

  it("exchange 4 includes awareness checkpoint (id=2), NOT insight (id=6)", () => {
    const state = makeState({ exchangeCount: 4 });
    const ids = getActiveInterventions(state).map((i) => i.id);
    expect(ids).toContain(2);
    expect(ids).not.toContain(6);
  });

  it("exchange 8 includes insight checkpoint (id=6), NOT awareness (id=2)", () => {
    const state = makeState({ exchangeCount: 8 });
    const ids = getActiveInterventions(state).map((i) => i.id);
    expect(ids).toContain(6);
    expect(ids).not.toContain(2);
  });

  it("exchange 12 includes awareness (id=2), NOT insight (id=6)", () => {
    const state = makeState({ exchangeCount: 12 });
    const ids = getActiveInterventions(state).map((i) => i.id);
    expect(ids).toContain(2);
    expect(ids).not.toContain(6);
  });

  it("exchange 16 includes insight (id=6), NOT awareness (id=2)", () => {
    const state = makeState({ exchangeCount: 16 });
    const ids = getActiveInterventions(state).map((i) => i.id);
    expect(ids).toContain(6);
    expect(ids).not.toContain(2);
  });

  it("rapid-fire timestamps includes breath-anchored pacing (id=1)", () => {
    const now = Date.now();
    const state = makeState({
      recentMessageTimestamps: [now, now + 5_000, now + 10_000],
    });
    const ids = getActiveInterventions(state).map((i) => i.id);
    expect(ids).toContain(1);
  });

  it("intention set includes purpose anchor (id=7)", () => {
    const state = makeState({ intention: "be more present" });
    const ids = getActiveInterventions(state).map((i) => i.id);
    expect(ids).toContain(7);
  });
});

// ---------------------------------------------------------------------------
// shouldShowOverlay
// ---------------------------------------------------------------------------
describe("shouldShowOverlay", () => {
  it("returns null when no overlays are active", () => {
    const state = makeState({ phase: "conversation", exchangeCount: 1 });
    expect(shouldShowOverlay(state)).toBeNull();
  });

  it("returns awareness overlay when only awareness is active", () => {
    const state = makeState({ exchangeCount: 4 });
    const overlay = shouldShowOverlay(state);
    expect(overlay).not.toBeNull();
    expect(overlay!.id).toBe(2);
  });

  it("returns insight (id=6) when both awareness and insight could fire (exchange 8)", () => {
    // At exchange 8: 8 % 4 === 0 but 8 % 8 === 0 too, so awareness is suppressed and insight fires
    const state = makeState({ exchangeCount: 8 });
    const overlay = shouldShowOverlay(state);
    expect(overlay).not.toBeNull();
    expect(overlay!.id).toBe(6);
  });

  it("returns gratitude overlay during reflection phase", () => {
    const state = makeState({ phase: "reflection" });
    const overlay = shouldShowOverlay(state);
    expect(overlay).not.toBeNull();
    expect(overlay!.id).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// getPromptModifiers
// ---------------------------------------------------------------------------
describe("getPromptModifiers", () => {
  it("conversation phase includes compassion and assumption text", () => {
    const state = makeState({ phase: "conversation" });
    const modifiers = getPromptModifiers(state);
    expect(modifiers).toContain("compassion");
    expect(modifiers).toContain("assumption");
  });

  it("conversation phase with intention includes intention text", () => {
    const state = makeState({ phase: "conversation", intention: "be kinder" });
    const modifiers = getPromptModifiers(state);
    expect(modifiers).toContain("intention");
  });

  it("intention substitution replaces {intention} with actual value", () => {
    const state = makeState({ phase: "conversation", intention: "find clarity" });
    const modifiers = getPromptModifiers(state);
    expect(modifiers).toContain("find clarity");
    expect(modifiers).not.toContain("{intention}");
  });
});

// ---------------------------------------------------------------------------
// getActiveTint
// ---------------------------------------------------------------------------
describe("getActiveTint", () => {
  it("returns overlay tint when overlay is active", () => {
    // exchange 4 triggers awareness overlay (id=2, tint=blue)
    const state = makeState({ exchangeCount: 4 });
    expect(getActiveTint(state)).toBe("blue");
  });

  it("returns prompt tint when only prompt interventions are active", () => {
    // conversation phase triggers compassionate mirroring (id=3, tint=rose)
    const state = makeState({ phase: "conversation", exchangeCount: 1 });
    expect(getActiveTint(state)).toBe("rose");
  });

  it('returns "neutral" when nothing is active', () => {
    // arrival phase, exchange 0, no intention, no rapid-fire
    const state = makeState({ phase: "arrival", exchangeCount: 0, intention: "" });
    expect(getActiveTint(state)).toBe("neutral");
  });
});

// ---------------------------------------------------------------------------
// getPacingMultiplier
// ---------------------------------------------------------------------------
describe("getPacingMultiplier", () => {
  it("returns 0.6 when rapid fire is detected", () => {
    const now = Date.now();
    const state = makeState({
      recentMessageTimestamps: [now, now + 5_000, now + 10_000],
    });
    expect(getPacingMultiplier(state)).toBe(0.6);
  });

  it("returns 1.0 under normal conditions", () => {
    const state = makeState();
    expect(getPacingMultiplier(state)).toBe(1.0);
  });
});
