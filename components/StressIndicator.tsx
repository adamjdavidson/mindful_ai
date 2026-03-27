"use client";

interface StressIndicatorProps {
  score: number;
  size?: number;
}

/**
 * Display 1-5 dots representing stress/presence level.
 * Filled dots up to the score level with sage color.
 * Same visual language as SelfReport dots.
 */
export default function StressIndicator({ score, size = 8 }: StressIndicatorProps) {
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Stress score ${score} of 5`}>
      {[1, 2, 3, 4, 5].map((level) => {
        const filled = level <= score;
        const opacity = filled ? 0.5 + (level / 5) * 0.5 : 0.3;

        return (
          <span
            key={level}
            className="rounded-full inline-block"
            style={{
              width: filled ? size + 2 : size,
              height: filled ? size + 2 : size,
              backgroundColor: filled ? "var(--sage)" : "transparent",
              border: "1.5px solid var(--sage)",
              opacity,
            }}
          />
        );
      })}
    </div>
  );
}
