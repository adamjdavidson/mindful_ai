"use client";

import StressIndicator from "./StressIndicator";

interface TimelineRowProps {
  time: string;
  title: string;
  stressScore: number;
  isPast: boolean;
  coaching?: {
    content: string;
    pillar: string;
    responseScore?: number;
  } | null;
  onStressChange?: (score: number) => void;
}

export default function TimelineRow({
  time,
  title,
  stressScore,
  isPast,
  coaching,
  onStressChange,
}: TimelineRowProps) {
  return (
    <div className={`flex flex-col gap-0.5 py-2 ${isPast ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted w-12 shrink-0 font-body">
          {time}
        </span>
        <span className="text-sm truncate flex-1">{title}</span>
        <StressIndicator
          score={stressScore}
          size={6}
          interactive={!isPast}
          onChange={onStressChange}
        />
      </div>
      {coaching && (
        <div className="flex items-start gap-2 ml-15 pl-0.5">
          <span
            className="inline-block w-2 h-2 rounded-full mt-1.5 shrink-0"
            style={{ backgroundColor: "var(--sage)" }}
          />
          <span className="text-xs italic text-muted flex-1">
            {coaching.content}
          </span>
          {coaching.responseScore != null && (
            <span className="text-xs text-muted shrink-0">
              {coaching.responseScore}/5
            </span>
          )}
        </div>
      )}
    </div>
  );
}
