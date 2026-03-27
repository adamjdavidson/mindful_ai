"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { tourStops, type TourStop } from "@/lib/tourData";
import BreathingCircle from "@/components/BreathingCircle";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeatureTourProps {
  isActive: boolean;
  mode: "tour" | "inspect";
  inspectTarget?: string;
  onClose: () => void;
  onComplete?: () => void;
  onTintOverride?: (
    tint: "blue" | "rose" | "violet" | "amber" | "neutral" | null,
  ) => void;
}

type Placement = "top" | "bottom" | "left" | "right";

// ---------------------------------------------------------------------------
// Pillar colour map
// ---------------------------------------------------------------------------

const PILLAR_COLORS: Record<TourStop["pillar"], string> = {
  awareness: "rgb(147, 197, 222)",
  connection: "rgb(210, 150, 150)",
  insight: "rgb(170, 150, 200)",
  purpose: "rgb(200, 170, 110)",
};

const PILLAR_TINT_MAP: Record<
  TourStop["pillar"],
  "blue" | "rose" | "violet" | "amber"
> = {
  awareness: "blue",
  connection: "rose",
  insight: "violet",
  purpose: "amber",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/** Pick the best side for the tooltip given target rect and viewport. */
function pickPlacement(
  rect: DOMRect,
  tooltipW: number,
  tooltipH: number,
): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceAbove = rect.top;
  const spaceBelow = vh - rect.bottom;
  const spaceLeft = rect.left;
  const spaceRight = vw - rect.right;

  // Prefer below, then above, then right, then left
  if (spaceBelow >= tooltipH + 16) return "bottom";
  if (spaceAbove >= tooltipH + 16) return "top";
  if (spaceRight >= tooltipW + 16) return "right";
  if (spaceLeft >= tooltipW + 16) return "left";
  return "bottom"; // fallback
}

/** Compute tooltip x/y given placement and target rect. */
function tooltipPosition(
  placement: Placement,
  rect: DOMRect,
  tooltipW: number,
  tooltipH: number,
): { x: number; y: number } {
  const gap = 14;
  let x: number;
  let y: number;

  switch (placement) {
    case "bottom":
      x = rect.left + rect.width / 2 - tooltipW / 2;
      y = rect.bottom + gap;
      break;
    case "top":
      x = rect.left + rect.width / 2 - tooltipW / 2;
      y = rect.top - tooltipH - gap;
      break;
    case "right":
      x = rect.right + gap;
      y = rect.top + rect.height / 2 - tooltipH / 2;
      break;
    case "left":
      x = rect.left - tooltipW - gap;
      y = rect.top + rect.height / 2 - tooltipH / 2;
      break;
  }

  // Clamp within viewport
  const pad = 12;
  x = Math.max(pad, Math.min(x, window.innerWidth - tooltipW - pad));
  y = Math.max(pad, Math.min(y, window.innerHeight - tooltipH - pad));

  return { x, y };
}

// ---------------------------------------------------------------------------
// Arrow SVG helper
// ---------------------------------------------------------------------------

function Arrow({
  placement,
  color,
}: {
  placement: Placement;
  color: string;
}) {
  const size = 10;
  const style: React.CSSProperties = { position: "absolute" };

  switch (placement) {
    case "bottom":
      style.top = -size;
      style.left = "50%";
      style.transform = "translateX(-50%)";
      return (
        <svg
          width={size * 2}
          height={size}
          style={style}
          viewBox={`0 0 ${size * 2} ${size}`}
        >
          <polygon
            points={`0,${size} ${size},0 ${size * 2},${size}`}
            fill={isDark() ? "rgba(28,25,23,0.95)" : "rgba(250,245,240,0.95)"}
            stroke={color}
            strokeWidth={1}
          />
        </svg>
      );
    case "top":
      style.bottom = -size;
      style.left = "50%";
      style.transform = "translateX(-50%)";
      return (
        <svg
          width={size * 2}
          height={size}
          style={style}
          viewBox={`0 0 ${size * 2} ${size}`}
        >
          <polygon
            points={`0,0 ${size},${size} ${size * 2},0`}
            fill={isDark() ? "rgba(28,25,23,0.95)" : "rgba(250,245,240,0.95)"}
            stroke={color}
            strokeWidth={1}
          />
        </svg>
      );
    case "right":
      style.left = -size;
      style.top = "50%";
      style.transform = "translateY(-50%)";
      return (
        <svg
          width={size}
          height={size * 2}
          style={style}
          viewBox={`0 0 ${size} ${size * 2}`}
        >
          <polygon
            points={`${size},0 0,${size} ${size},${size * 2}`}
            fill={isDark() ? "rgba(28,25,23,0.95)" : "rgba(250,245,240,0.95)"}
            stroke={color}
            strokeWidth={1}
          />
        </svg>
      );
    case "left":
      style.right = -size;
      style.top = "50%";
      style.transform = "translateY(-50%)";
      return (
        <svg
          width={size}
          height={size * 2}
          style={style}
          viewBox={`0 0 ${size} ${size * 2}`}
        >
          <polygon
            points={`0,0 ${size},${size} 0,${size * 2}`}
            fill={isDark() ? "rgba(28,25,23,0.95)" : "rgba(250,245,240,0.95)"}
            stroke={color}
            strokeWidth={1}
          />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Simulation components
// ---------------------------------------------------------------------------

function SimBreathingCircle() {
  return (
    <div className="flex items-center justify-center rounded-2xl bg-background/80 p-8">
      <BreathingCircle size={80} showLabel={true} />
    </div>
  );
}

function SimMeditationOption() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-background/80 p-6">
      {["Skip", "15 sec", "40 sec", "1 min"].map((label) => (
        <span
          key={label}
          className="rounded-full border border-warm-gray px-4 py-1.5 text-sm text-foreground"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function SimIntentionSetting() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/80 p-6">
      <p className="font-sans text-base text-foreground">
        What&apos;s your intention?
      </p>
      <input
        readOnly
        placeholder="I want to..."
        className="w-56 rounded-lg border border-warm-gray bg-background px-3 py-2 text-sm text-muted"
      />
    </div>
  );
}

function SimMindfulOverlay() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-background/80 p-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sage/20">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="text-sage"
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </svg>
      </div>
      <p className="text-sm text-foreground">
        What are you noticing right now?
      </p>
    </div>
  );
}

function SimAIResponse() {
  return (
    <div className="max-w-xs rounded-2xl rounded-bl-md bg-warm-gray-light px-5 py-3 text-base leading-relaxed text-foreground">
      I notice you&apos;re exploring something that matters to you. What feels
      most alive in this question?
    </div>
  );
}

function SimSessionClosing() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-background/80 p-6">
      <BreathingCircle size={48} showLabel={false} />
      <p className="text-center text-sm text-foreground">
        Thank you for being present.
      </p>
    </div>
  );
}

const SIMULATION_MAP: Record<string, React.FC> = {
  "breathing-circle": SimBreathingCircle,
  "meditation-option": SimMeditationOption,
  "intention-setting": SimIntentionSetting,
  "mindful-overlay": SimMindfulOverlay,
  "ai-response": SimAIResponse,
  "session-closing": SimSessionClosing,
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FeatureTour({
  isActive,
  mode,
  inspectTarget,
  onClose,
  onComplete,
  onTintOverride,
}: FeatureTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [scienceOpen, setScienceOpen] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [simRect, setSimRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState({ w: 340, h: 200 });
  const [mounted, setMounted] = useState(false);

  // --- Determine which stops and which stop is active ---
  const stops = mode === "inspect" && inspectTarget
    ? tourStops.filter((s) => s.id === inspectTarget)
    : tourStops;

  const stop: TourStop | undefined = stops[mode === "tour" ? currentStep : 0];
  const totalSteps = stops.length;
  const isLastStep = mode === "tour" && currentStep === totalSteps - 1;

  // Is the real DOM element present?
  const realEl =
    stop && typeof document !== "undefined"
      ? document.querySelector(stop.selector)
      : null;
  const needsSimulation = stop?.simulate && !realEl;
  const pillarColor = stop ? PILLAR_COLORS[stop.pillar] : "#999";

  // --- Mount gate ---
  useEffect(() => {
    setMounted(true);
  }, []);

  // --- Reset state when step changes ---
  useEffect(() => {
    setScienceOpen(false);
    setFadeIn(false);
    const t = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(t);
  }, [currentStep, isActive]);

  // --- Measure target element ---
  const measureTarget = useCallback(() => {
    if (!stop) return;
    if (needsSimulation) {
      // Use the simulation container's rect
      if (simRef.current) {
        setSimRect(simRef.current.getBoundingClientRect());
      }
      setTargetRect(null);
    } else {
      const el = document.querySelector(stop.selector);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
      setSimRect(null);
    }
  }, [stop, needsSimulation]);

  useEffect(() => {
    if (!isActive) return;
    measureTarget();
    const id = setInterval(measureTarget, 200);
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      clearInterval(id);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [isActive, measureTarget]);

  // --- Measure tooltip ---
  useEffect(() => {
    if (tooltipRef.current) {
      const r = tooltipRef.current.getBoundingClientRect();
      setTooltipSize({ w: r.width, h: r.height });
    }
  });

  // --- Pillar tint cycling for pillar-tint stop ---
  useEffect(() => {
    if (!isActive || !stop || stop.id !== "pillar-tint" || !onTintOverride)
      return;
    const tints: Array<"blue" | "rose" | "violet" | "amber"> = [
      "blue",
      "rose",
      "violet",
      "amber",
    ];
    let i = 0;
    onTintOverride(tints[i]);
    const interval = setInterval(() => {
      i = (i + 1) % tints.length;
      onTintOverride(tints[i]);
    }, 1500);
    return () => {
      clearInterval(interval);
      onTintOverride(null);
    };
  }, [isActive, stop, onTintOverride]);

  // --- Keyboard support ---
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (mode === "tour") {
        if (e.key === "ArrowRight" || e.key === "Enter") {
          if (isLastStep) {
            onComplete?.();
            onClose();
          } else {
            setCurrentStep((s) => Math.min(s + 1, totalSteps - 1));
          }
        } else if (e.key === "ArrowLeft") {
          setCurrentStep((s) => Math.max(s - 1, 0));
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, mode, isLastStep, totalSteps, onClose, onComplete]);

  // --- Click-outside for inspect mode ---
  useEffect(() => {
    if (!isActive || mode !== "inspect") return;
    const handler = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    // Delay to avoid immediately closing
    const t = setTimeout(() => {
      window.addEventListener("mousedown", handler);
    }, 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", handler);
    };
  }, [isActive, mode, onClose]);

  // --- Reset step when tour becomes active ---
  useEffect(() => {
    if (isActive && mode === "tour") {
      setCurrentStep(0);
    }
  }, [isActive, mode]);

  // --- Render ---
  if (!isActive || !stop || !mounted) return null;

  const activeRect = needsSimulation ? simRect : targetRect;
  const dark = isDark();

  // Spotlight clip-path (box-shadow approach for simplicity)
  const spotlightPad = 12;
  let clipPath = "none";
  if (mode === "tour" && activeRect) {
    const top = activeRect.top - spotlightPad;
    const left = activeRect.left - spotlightPad;
    const right = activeRect.right + spotlightPad;
    const bottom = activeRect.bottom + spotlightPad;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // polygon with a rectangular cutout
    clipPath = `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${left}px ${top}px,
      ${left}px ${bottom}px,
      ${right}px ${bottom}px,
      ${right}px ${top}px,
      ${left}px ${top}px
    )`;
    void vw;
    void vh;
  }

  // Tooltip placement
  const placement: Placement = activeRect
    ? pickPlacement(activeRect, tooltipSize.w, tooltipSize.h)
    : "bottom";
  const tooltipPos = activeRect
    ? tooltipPosition(placement, activeRect, tooltipSize.w, tooltipSize.h)
    : {
        x: window.innerWidth / 2 - tooltipSize.w / 2,
        y: window.innerHeight / 2 + 60,
      };

  const SimComponent = needsSimulation ? SIMULATION_MAP[stop.id] : null;

  // Highlight the pillar name in the science text
  function renderScience(text: string, pillar: TourStop["pillar"]) {
    const pillarNames: Record<TourStop["pillar"], string> = {
      awareness: "Awareness",
      connection: "Connection",
      insight: "Insight",
      purpose: "Purpose",
    };
    const name = pillarNames[pillar];
    const idx = text.indexOf(name);
    if (idx === -1) {
      // Try lowercase
      const lowerIdx = text.toLowerCase().indexOf(name.toLowerCase());
      if (lowerIdx === -1) return <>{text}</>;
      return (
        <>
          {text.slice(0, lowerIdx)}
          <span style={{ color: PILLAR_COLORS[pillar], fontWeight: 500 }}>
            {text.slice(lowerIdx, lowerIdx + name.length)}
          </span>
          {text.slice(lowerIdx + name.length)}
        </>
      );
    }
    return (
      <>
        {text.slice(0, idx)}
        <span style={{ color: PILLAR_COLORS[pillar], fontWeight: 500 }}>
          {text.slice(idx, idx + name.length)}
        </span>
        {text.slice(idx + name.length)}
      </>
    );
  }

  return createPortal(
    <div
      style={{ opacity: fadeIn ? 1 : 0, transition: "opacity 300ms ease" }}
    >
      {/* Spotlight overlay (tour mode only) */}
      {mode === "tour" && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.6)",
            clipPath: activeRect ? clipPath : "none",
            transition: "clip-path 300ms ease",
            pointerEvents: activeRect ? "auto" : "none",
          }}
          onClick={(e) => {
            // Prevent clicks on spotlight from going through
            e.stopPropagation();
          }}
        />
      )}

      {/* Simulation portal — position matches where the real element appears */}
      {needsSimulation && SimComponent && (
        <div
          ref={simRef}
          style={{
            position: "fixed",
            zIndex: 101,
            ...(stop.id === "mindful-overlay"
              ? { bottom: 24, right: 24 }
              : stop.id === "self-report"
                ? { bottom: 16, left: 16 }
                : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
          }}
        >
          <SimComponent />
        </div>
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-label={stop.title}
        style={{
          position: "fixed",
          zIndex: 102,
          left: tooltipPos.x,
          top: tooltipPos.y,
          maxWidth: 340,
          borderRadius: 12,
          border: `1px solid ${pillarColor}`,
          background: dark
            ? "rgba(28,25,23,0.95)"
            : "rgba(250,245,240,0.95)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          color: dark ? "#e8e4df" : "#2d2a26",
          transition: "left 300ms ease, top 300ms ease",
        }}
      >
        <Arrow placement={placement} color={pillarColor} />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close tour"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: dark ? "#9a9488" : "#8a8478",
            padding: 4,
            lineHeight: 1,
            fontSize: 18,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div style={{ padding: "16px 20px 14px" }}>
          {/* Step counter (tour mode) */}
          {mode === "tour" && (
            <p
              style={{
                fontSize: 12,
                color: dark ? "#9a9488" : "#8a8478",
                marginBottom: 6,
              }}
            >
              {currentStep + 1} of {totalSteps}
            </p>
          )}

          {/* Layer 1: title + description */}
          <h3
            style={{
              fontSize: 15,
              fontWeight: 500,
              marginBottom: 6,
              lineHeight: 1.3,
            }}
          >
            {stop.title}
          </h3>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: dark ? "#9a9488" : "#8a8478",
              marginBottom: 10,
            }}
          >
            {stop.description}
          </p>

          {/* Layer 2: expandable science section */}
          <button
            onClick={() => setScienceOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: pillarColor,
              padding: 0,
              marginBottom: scienceOpen ? 8 : 0,
            }}
          >
            <span>The science</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{
                transform: scienceOpen ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 200ms ease",
              }}
            >
              <path
                d="M4.5 2.5l3 3.5-3 3.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div
            style={{
              overflow: "hidden",
              maxHeight: scienceOpen ? 300 : 0,
              transition: "max-height 200ms ease",
            }}
          >
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.55,
                color: dark ? "#9a9488" : "#8a8478",
              }}
            >
              {renderScience(stop.science, stop.pillar)}
            </p>
          </div>

          {/* Navigation (tour mode only) */}
          {mode === "tour" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 14,
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {currentStep > 0 && (
                  <button
                    onClick={() =>
                      setCurrentStep((s) => Math.max(s - 1, 0))
                    }
                    style={{
                      fontSize: 13,
                      padding: "5px 12px",
                      borderRadius: 8,
                      border: `1px solid ${dark ? "#3a3632" : "#d4cfc8"}`,
                      background: "transparent",
                      color: dark ? "#e8e4df" : "#2d2a26",
                      cursor: "pointer",
                    }}
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => {
                    if (isLastStep) {
                      onComplete?.();
                      onClose();
                    } else {
                      setCurrentStep((s) =>
                        Math.min(s + 1, totalSteps - 1),
                      );
                    }
                  }}
                  style={{
                    fontSize: 13,
                    padding: "5px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: pillarColor,
                    color: "#1a1816",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {isLastStep ? "Done" : "Next"}
                </button>
              </div>
            </div>
          )}

          {/* Skip link (tour mode) */}
          {mode === "tour" && (
            <button
              onClick={onClose}
              style={{
                display: "block",
                marginTop: 8,
                fontSize: 11,
                color: dark ? "#9a9488" : "#8a8478",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
