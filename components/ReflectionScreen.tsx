"use client";

import { useState, useEffect } from "react";
import BreathingCircle from "./BreathingCircle";

interface ReflectionScreenProps {
  /** AI-generated reflection text */
  reflectionText: string;
  /** Whether the reflection is still loading */
  isLoading: boolean;
  /** Called with the user's takeaway */
  onComplete: (takeaway: string) => void;
}

export default function ReflectionScreen({
  reflectionText,
  isLoading,
  onComplete,
}: ReflectionScreenProps) {
  const [takeaway, setTakeaway] = useState("");
  const [phase, setPhase] = useState<"meditation" | "takeaway">("meditation");
  const [visibleLines, setVisibleLines] = useState(0);

  const lines = reflectionText
    .split(/\n\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Reveal lines one at a time
  useEffect(() => {
    if (isLoading || lines.length === 0) return;
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setVisibleLines(current);
      if (current >= lines.length) {
        clearInterval(interval);
        setTimeout(() => setPhase("takeaway"), 3000);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isLoading, lines.length]);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center px-6 animate-fade-in">
      <div className="flex flex-col items-center gap-10 max-w-md w-full">
        <BreathingCircle size={100} showLabel={false} />

        {phase === "meditation" && (
          <div className="flex flex-col items-center gap-4 min-h-[200px]">
            {isLoading ? (
              <p className="text-muted text-sm animate-pulse">
                Reflecting on your conversation...
              </p>
            ) : (
              lines.slice(0, visibleLines).map((line, i) => (
                <p
                  key={i}
                  className="text-center text-lg leading-relaxed animate-fade-in"
                  style={{
                    fontFamily: "var(--font-source-serif), Georgia, serif",
                  }}
                >
                  {line}
                </p>
              ))
            )}
          </div>
        )}

        {phase === "takeaway" && (
          <div className="flex flex-col items-center gap-6 w-full animate-fade-in">
            <p
              className="text-xl text-center"
              style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
            >
              What&apos;s one thing you&apos;re taking away?
            </p>
            <textarea
              value={takeaway}
              onChange={(e) => setTakeaway(e.target.value)}
              placeholder="Something I noticed..."
              rows={2}
              className="w-full bg-transparent border-b-2 border-warm-gray focus:border-sage outline-none resize-none text-lg py-3 px-1 placeholder:text-muted/50 transition-colors"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => onComplete("")}
                className="px-6 py-2.5 rounded-full text-sm border border-warm-gray text-muted hover:border-sage transition-colors"
              >
                Skip
              </button>
              <button
                onClick={() => onComplete(takeaway)}
                className="px-6 py-2.5 rounded-full text-sm bg-sage text-white hover:bg-sage/90 transition-colors"
              >
                Complete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
