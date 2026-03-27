"use client";

import { useState, useEffect, useCallback } from "react";
import type { SelfReportData } from "@/lib/telemetry";

interface SelfReportProps {
  /** Called whenever a dot is clicked with the current rating */
  onChange?: (data: Partial<SelfReportData>) => void;
}

/**
 * Persistent ambient self-report: 5 dots representing a spectrum
 * from scattered to present. One dimension, not five questions.
 *
 * Based on Dahl & Davidson's awareness pillar: the spectrum from
 * mind-wandering (default mode network active) to meta-aware
 * (attentionally stable, present).
 *
 * Scattered ○ ○ ○ ○ ○ Present
 */

const states = [
  { level: 1, label: "Scattered" },
  { level: 2, label: "Restless" },
  { level: 3, label: "Settling" },
  { level: 4, label: "Focused" },
  { level: 5, label: "Present" },
];

export default function SelfReport({ onChange }: SelfReportProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [hoveredDot, setHoveredDot] = useState<number | null>(null);

  const handleClick = useCallback((level: number) => {
    // Toggle: click same dot to deselect
    setSelected((prev) => (prev === level ? null : level));
  }, []);

  // Notify parent when selection changes
  useEffect(() => {
    if (selected === null) return;
    const data: Partial<SelfReportData> = {
      awareness: selected,
      timestamp: Date.now(),
    };
    onChange?.(data);
  }, [selected, onChange]);

  const displayLabel = hoveredDot !== null
    ? states[hoveredDot - 1].label
    : selected !== null
      ? states[selected - 1].label
      : null;

  return (
    <div
      className="fixed bottom-4 left-4 z-30 flex items-center gap-1.5"
      role="group"
      aria-label="How present do you feel? Scattered to Present"
    >
      {states.map((state) => {
        const isSelected = selected === state.level;
        const isBelow = selected !== null && state.level <= selected;
        // Dots fill up to the selected level (like a rating bar)
        const filled = isBelow;
        const size = filled ? 10 : 8;

        // Color gradient from muted warm to sage as you go toward Present
        const opacity = filled ? 0.5 + (state.level / 5) * 0.5 : 0.3;

        return (
          <button
            key={state.level}
            type="button"
            onClick={() => handleClick(state.level)}
            onMouseEnter={() => setHoveredDot(state.level)}
            onMouseLeave={() => setHoveredDot(null)}
            className="rounded-full transition-all duration-300 hover:scale-150"
            style={{
              width: size,
              height: size,
              backgroundColor: filled ? "var(--sage)" : "transparent",
              border: `1.5px solid var(--sage)`,
              opacity,
            }}
            aria-label={`${state.label} (${state.level} of 5)`}
          />
        );
      })}
      {displayLabel && (
        <span
          className="ml-1.5 text-xs text-muted transition-opacity duration-300 animate-fade-in"
          style={{ minWidth: 60 }}
        >
          {displayLabel}
        </span>
      )}
    </div>
  );
}
