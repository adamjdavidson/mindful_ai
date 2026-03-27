"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import BreathingCircle from "./BreathingCircle";

interface MindfulOverlayProps {
  content: string | null;
  pillar: "awareness" | "connection" | "insight" | "purpose" | null;
  autoDismissMs?: number;
  onDismiss?: () => void;
}

const defaultDurations: Record<string, number> = {
  awareness: 8000,
  connection: 12000,
  insight: 12000,
  purpose: 12000,
};

export default function MindfulOverlay({
  content,
  pillar,
  autoDismissMs,
  onDismiss,
}: MindfulOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeOutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (fadeOutTimerRef.current) {
      clearTimeout(fadeOutTimerRef.current);
      fadeOutTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    setFadingOut(true);
    fadeOutTimerRef.current = setTimeout(() => {
      setVisible(false);
      setFadingOut(false);
      onDismiss?.();
    }, 500);
  }, [clearTimers, onDismiss]);

  // Show/hide based on content
  useEffect(() => {
    if (content !== null) {
      setVisible(true);
      setFadingOut(false);

      const duration =
        autoDismissMs ?? defaultDurations[pillar ?? "awareness"] ?? 8000;

      clearTimers();
      dismissTimerRef.current = setTimeout(dismiss, duration);
    } else {
      if (visible && !fadingOut) {
        dismiss();
      }
    }

    return clearTimers;
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key handler
  useEffect(() => {
    if (!visible || fadingOut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visible, fadingOut, dismiss]);

  const isActive = visible && !fadingOut;

  return (
    <div
      role="status"
      data-tour-id="mindful-overlay"
      aria-live="polite"
      className={`
        fixed z-50
        bottom-0 right-0 left-0 sm:bottom-6 sm:right-6 sm:left-auto
        sm:max-w-[280px]
        rounded-t-2xl sm:rounded-2xl
        border border-warm-gray
        bg-background/85 backdrop-blur-sm
        p-5
        transition-all
        ${visible ? "" : "invisible"}
      `}
      style={{
        opacity: !visible ? 0 : fadingOut ? 0 : 1,
        transform: !visible
          ? "translateY(8px)"
          : fadingOut
            ? "translateY(0)"
            : "translateY(0)",
        transition: fadingOut
          ? "opacity 0.5s ease"
          : "opacity 1s ease, transform 1s ease",
        pointerEvents: isActive ? "auto" : "none",
      }}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <BreathingCircle size={48} showLabel={false} active={isActive} />
        </div>
        <p className="font-body text-sm font-normal text-muted leading-relaxed">
          {content}
        </p>
      </div>
    </div>
  );
}
