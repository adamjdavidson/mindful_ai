"use client";

const pillarColors: Record<string, string> = {
  awareness: "rgb(147,197,222)",
  connection: "rgb(210,150,150)",
  insight: "rgb(170,150,200)",
  purpose: "rgb(200,170,110)",
};

const pillarLabels: Record<string, string> = {
  awareness: "Awareness",
  connection: "Connection",
  insight: "Insight",
  purpose: "Purpose",
};

interface ACIPBarProps {
  counts: Record<string, number>;
}

export default function ACIPBar({ counts }: ACIPBarProps) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  if (total === 0) {
    return (
      <div
        className="w-full h-2 rounded-full"
        style={{ backgroundColor: "var(--warm-gray)" }}
        aria-label="No pillar data yet"
      />
    );
  }

  const segments = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([pillar, n]) => ({
      pillar,
      pct: Math.round((n / total) * 100),
      color: pillarColors[pillar] ?? "var(--warm-gray)",
    }));

  const ariaLabel = segments
    .map((s) => `${pillarLabels[s.pillar] ?? s.pillar} ${s.pct}%`)
    .join(", ");

  return (
    <div
      className="w-full h-2 rounded-full overflow-hidden flex"
      aria-label={ariaLabel}
    >
      {segments.map((s) => (
        <div
          key={s.pillar}
          style={{
            width: `${s.pct}%`,
            backgroundColor: s.color,
            minWidth: 4,
          }}
        />
      ))}
    </div>
  );
}
