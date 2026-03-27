import { describe, it, expect } from "vitest";
import {
  createTelemetry,
  recordMessage,
  recordCheckpoint,
  finalizeTelemetry,
} from "../telemetry";

describe("createTelemetry", () => {
  it("returns initialized empty object", () => {
    const t = createTelemetry();
    expect(t.messageTimestamps).toEqual([]);
    expect(t.messageLengths).toEqual([]);
    expect(t.checkpointEngagements).toEqual([]);
    expect(t.meditationCompleted).toBe(false);
    expect(t.reflectionLength).toBe(0);
    expect(t.sessionDurationMs).toBe(0);
  });
});

describe("recordMessage", () => {
  it("appends timestamp and length", () => {
    const t = createTelemetry();
    const updated = recordMessage(t, "hello world");
    expect(updated.messageTimestamps).toHaveLength(1);
    expect(updated.messageLengths).toEqual([11]);
  });
});

describe("recordCheckpoint", () => {
  it("engaged=true when durationMs >= 2000", () => {
    const t = createTelemetry();
    const updated = recordCheckpoint(t, "awareness", 2000);
    expect(updated.checkpointEngagements).toHaveLength(1);
    expect(updated.checkpointEngagements[0].engaged).toBe(true);
  });

  it("engaged=false when durationMs < 2000", () => {
    const t = createTelemetry();
    const updated = recordCheckpoint(t, "awareness", 1999);
    expect(updated.checkpointEngagements[0].engaged).toBe(false);
  });
});

describe("finalizeTelemetry", () => {
  it("sessionDurationMs is positive", () => {
    const t = createTelemetry();
    const startedAt = Date.now() - 5000;
    const finalized = finalizeTelemetry(t, startedAt);
    expect(finalized.sessionDurationMs).toBeGreaterThan(0);
  });
});
