import { describe, it, expect } from "vitest";
import { computePillarCoverage, createSession } from "../session";

describe("computePillarCoverage", () => {
  it("only includes pillars with engaged=true", () => {
    const interventions = [
      { id: 1, pillar: "awareness", timestamp: 1000, engaged: true },
      { id: 2, pillar: "connection", timestamp: 2000, engaged: false },
    ];
    const coverage = computePillarCoverage(interventions);
    expect(coverage).toContain("awareness");
    expect(coverage).not.toContain("connection");
  });

  it("deduplicates (two awareness interventions produce one 'awareness' in result)", () => {
    const interventions = [
      { id: 1, pillar: "awareness", timestamp: 1000, engaged: true },
      { id: 2, pillar: "awareness", timestamp: 2000, engaged: true },
    ];
    const coverage = computePillarCoverage(interventions);
    expect(coverage.filter((p) => p === "awareness")).toHaveLength(1);
  });
});

describe("createSession", () => {
  it("initializes telemetry and empty interventionsShown", () => {
    const session = createSession();
    expect(session.telemetry).toBeDefined();
    expect(session.telemetry.messageTimestamps).toEqual([]);
    expect(session.interventionsShown).toEqual([]);
    expect(session.phase).toBe("arrival");
    expect(session.id).toBeTruthy();
  });
});
