import { describe, it, expect } from "vitest";
import { FALLBACK_PROMPTS } from "../scoring";
import {
  summarizeAnnotationPatterns,
  findSimilarAnnotations,
  type UserAnnotation,
} from "../companion";

// ---------------------------------------------------------------------------
// FALLBACK_PROMPTS
// ---------------------------------------------------------------------------
describe("FALLBACK_PROMPTS", () => {
  it("has exactly 4 pillars", () => {
    expect(Object.keys(FALLBACK_PROMPTS)).toHaveLength(4);
  });

  it("has 2 prompts per pillar", () => {
    for (const pillar of Object.keys(FALLBACK_PROMPTS)) {
      expect(
        FALLBACK_PROMPTS[pillar as keyof typeof FALLBACK_PROMPTS],
      ).toHaveLength(2);
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

// ---------------------------------------------------------------------------
// summarizeAnnotationPatterns
// ---------------------------------------------------------------------------
describe("summarizeAnnotationPatterns", () => {
  it("returns default message for empty annotations", () => {
    expect(summarizeAnnotationPatterns({})).toBe(
      "No past event ratings available.",
    );
  });

  it("summarizes annotations with high and low stress events", () => {
    const annotations: Record<string, UserAnnotation> = {
      "evt-1": { stress: 5, title: "Board Review" },
      "evt-2": { stress: 4, title: "Performance Review" },
      "evt-3": { stress: 1, title: "Coffee Chat" },
      "evt-4": { stress: 2, title: "Team Lunch" },
    };
    const result = summarizeAnnotationPatterns(annotations);
    expect(result).toContain("4 events");
    expect(result).toContain("Board Review");
    expect(result).toContain("Coffee Chat");
  });

  it("computes correct average", () => {
    const annotations: Record<string, UserAnnotation> = {
      a: { stress: 2, title: "A" },
      b: { stress: 4, title: "B" },
    };
    const result = summarizeAnnotationPatterns(annotations);
    expect(result).toContain("3/5");
  });
});

// ---------------------------------------------------------------------------
// findSimilarAnnotations
// ---------------------------------------------------------------------------
describe("findSimilarAnnotations", () => {
  const annotations: Record<string, UserAnnotation> = {
    "evt-1": { stress: 4, title: "Team Sync" },
    "evt-2": { stress: 2, title: "1:1 with Alice" },
    "evt-3": { stress: 5, title: "Board Review" },
    "evt-4": { stress: 3, title: "Team Sync" },
  };

  it("finds exact title matches", () => {
    const results = findSimilarAnnotations(annotations, "Team Sync");
    expect(results).toHaveLength(2);
  });

  it("is case-insensitive", () => {
    const results = findSimilarAnnotations(annotations, "team sync");
    expect(results).toHaveLength(2);
  });

  it("finds substring matches", () => {
    const results = findSimilarAnnotations(annotations, "Board");
    expect(results).toHaveLength(1);
    expect(results[0].stress).toBe(5);
  });

  it("returns empty for no matches", () => {
    const results = findSimilarAnnotations(annotations, "Yoga Session");
    expect(results).toHaveLength(0);
  });
});
