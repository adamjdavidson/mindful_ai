"use client";

import { useState, useEffect, useRef } from "react";
import BreathingCircle from "./BreathingCircle";

interface MeditationScreenProps {
  /** The meditation text (lines separated by blank lines) */
  text: string;
  /** Called when meditation is complete and user clicks "I'm ready" */
  onComplete: () => void;
  /** Whether the meditation text is still loading */
  isLoading?: boolean;
}

export default function MeditationScreen({
  text,
  onComplete,
  isLoading = false,
}: MeditationScreenProps) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [showReady, setShowReady] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const lines = text
    .split(/\n\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  useEffect(() => {
    if (isLoading || lines.length === 0) return;

    // Reveal one line at a time, paced to breathing
    let current = 0;
    const revealNext = () => {
      current++;
      setVisibleLines(current);

      if (current >= lines.length) {
        // All lines shown, wait a moment then show "I'm ready"
        timerRef.current = setTimeout(() => setShowReady(true), 3000);
      } else {
        // Pace: ~5 seconds per line (one breathing cycle)
        timerRef.current = setTimeout(revealNext, 5000);
      }
    };

    // Start after a brief pause
    timerRef.current = setTimeout(revealNext, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoading, lines.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center px-6 animate-fade-in">
      <div className="flex flex-col items-center gap-10 max-w-md">
        <BreathingCircle size={120} showLabel={false} />

        <div className="flex flex-col items-center gap-4 min-h-[200px]">
          {isLoading ? (
            <p className="text-muted text-sm animate-pulse">
              Preparing your meditation...
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

        {showReady && (
          <button
            onClick={onComplete}
            className="animate-fade-in px-8 py-3 rounded-full border border-warm-gray text-muted hover:border-sage hover:text-sage transition-colors"
          >
            I&apos;m ready
          </button>
        )}
      </div>
    </div>
  );
}
