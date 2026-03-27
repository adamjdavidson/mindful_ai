"use client";

import { useState } from "react";

interface StressIndicatorProps {
  score: number;
  size?: number;
  interactive?: boolean;
  onChange?: (score: number) => void;
}

/**
 * Display 1-5 dots representing how demanding an event feels.
 * When interactive, dots are tappable. Hover shows a tooltip.
 */
export default function StressIndicator({
  score,
  size = 6,
  interactive = false,
  onChange,
}: StressIndicatorProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const labels = ["light", "easy", "moderate", "demanding", "intense"];

  const displayScore = hovered ?? score;

  return (
    <div
      className="relative flex items-center gap-1"
      role={interactive ? "slider" : "img"}
      aria-label={`How demanding: ${labels[score - 1] || "unrated"}, ${score} of 5`}
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={score}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => {
        setShowTooltip(false);
        setHovered(null);
      }}
    >
      {[1, 2, 3, 4, 5].map((level) => {
        const filled = level <= displayScore;
        const opacity = filled ? 0.5 + (level / 5) * 0.5 : 0.3;

        return (
          <span
            key={level}
            className={`rounded-full inline-block transition-all duration-150 ${
              interactive ? "cursor-pointer" : ""
            }`}
            style={{
              width: filled ? size + 2 : size,
              height: filled ? size + 2 : size,
              backgroundColor: filled ? "var(--sage)" : "transparent",
              border: "1.5px solid var(--sage)",
              opacity,
            }}
            onMouseEnter={() => {
              if (interactive) setHovered(level);
            }}
            onClick={() => {
              if (interactive && onChange) {
                onChange(level);
              }
            }}
          />
        );
      })}

      {/* Hover tooltip */}
      {showTooltip && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded text-xs pointer-events-none"
          style={{
            backgroundColor: "var(--warm-gray-light)",
            color: "var(--muted)",
          }}
        >
          {labels[displayScore - 1] || "unrated"}
        </div>
      )}
    </div>
  );
}
