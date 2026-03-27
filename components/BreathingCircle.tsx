"use client";

import { useState, useEffect, useCallback } from "react";

interface BreathingCircleProps {
  /** Inhale duration in seconds */
  inhale?: number;
  /** Hold duration in seconds */
  hold?: number;
  /** Exhale duration in seconds */
  exhale?: number;
  /** Size in pixels */
  size?: number;
  /** Whether the animation is running */
  active?: boolean;
  /** Show phase label */
  showLabel?: boolean;
}

type Phase = "inhale" | "hold" | "exhale";

export default function BreathingCircle({
  inhale = 3,
  hold = 2,
  exhale = 4,
  size = 160,
  active = true,
  showLabel = true,
}: BreathingCircleProps) {
  const [phase, setPhase] = useState<Phase>("inhale");
  const [scale, setScale] = useState(1);

  const cycleBreathing = useCallback(() => {
    if (!active) return;

    // Inhale: circles contract inward (gathering breath in)
    setPhase("inhale");
    setScale(0.6);

    const holdTimeout = setTimeout(() => {
      setPhase("hold");
    }, inhale * 1000);

    // Exhale: circles expand outward (releasing breath out)
    const exhaleTimeout = setTimeout(() => {
      setPhase("exhale");
      setScale(1);
    }, (inhale + hold) * 1000);

    const totalCycle = (inhale + hold + exhale) * 1000;

    return { holdTimeout, exhaleTimeout, totalCycle };
  }, [active, inhale, hold, exhale]);

  useEffect(() => {
    if (!active) return;

    let timeouts: { holdTimeout: NodeJS.Timeout; exhaleTimeout: NodeJS.Timeout } | undefined;
    let interval: NodeJS.Timeout;

    const start = () => {
      timeouts = cycleBreathing();
    };

    start();
    interval = setInterval(start, (inhale + hold + exhale) * 1000);

    return () => {
      clearInterval(interval);
      if (timeouts) {
        clearTimeout(timeouts.holdTimeout);
        clearTimeout(timeouts.exhaleTimeout);
      }
    };
  }, [active, cycleBreathing, inhale, hold, exhale]);

  const phaseLabel = phase === "inhale" ? "Breathe in" : phase === "hold" ? "Hold" : "Breathe out";

  return (
    <div className="flex flex-col items-center gap-6" data-tour-id="breathing-circle">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Outer glow */}
        <div
          className="absolute rounded-full bg-sage/10 transition-transform"
          style={{
            width: size,
            height: size,
            transform: `scale(${scale * 1.2})`,
            transitionDuration: `${phase === "inhale" ? inhale : phase === "exhale" ? exhale : 0.3}s`,
            transitionTimingFunction: "ease-in-out",
          }}
        />
        {/* Main circle */}
        <div
          className="absolute rounded-full bg-gradient-to-br from-sage/30 to-sage/50 backdrop-blur-sm transition-transform"
          style={{
            width: size * 0.75,
            height: size * 0.75,
            transform: `scale(${scale})`,
            transitionDuration: `${phase === "inhale" ? inhale : phase === "exhale" ? exhale : 0.3}s`,
            transitionTimingFunction: "ease-in-out",
          }}
        />
        {/* Inner circle */}
        <div
          className="absolute rounded-full bg-sage/20 transition-transform"
          style={{
            width: size * 0.4,
            height: size * 0.4,
            transform: `scale(${scale})`,
            transitionDuration: `${phase === "inhale" ? inhale : phase === "exhale" ? exhale : 0.3}s`,
            transitionTimingFunction: "ease-in-out",
          }}
        />
      </div>
      {showLabel && (
        <p className="text-muted text-sm tracking-wide transition-opacity duration-500">
          {phaseLabel}
        </p>
      )}
    </div>
  );
}
