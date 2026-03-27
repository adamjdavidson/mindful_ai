"use client";

import { useState, useEffect } from "react";
import { SessionSummary, getSessionHistory } from "@/lib/session";
import { SelfReportData } from "@/lib/telemetry";

interface DashboardProps {
  onClose: () => void;
}

const PILLAR_COLORS: Record<string, string> = {
  awareness: "rgb(147,197,222)",
  connection: "rgb(210,150,150)",
  insight: "rgb(170,150,200)",
  purpose: "rgb(200,170,110)",
};

const PILLAR_LABELS: Record<string, string> = {
  awareness: "Awareness",
  connection: "Connection",
  insight: "Insight",
  purpose: "Purpose",
};

const SCORE_KEYS: (keyof Pick<SelfReportData, "awareness" | "calm" | "agency" | "clarity">)[] = [
  "awareness",
  "calm",
  "agency",
  "clarity",
];

export default function Dashboard({ onClose }: DashboardProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    setSessions(getSessionHistory());
  }, []);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return "< 1 min";
    return `${minutes} min`;
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDelta = (delta: number) => {
    if (delta > 0) return `+${delta}`;
    return `${delta}`;
  };

  const truncateIntention = (text: string, maxLen = 80) => {
    if (!text || text.length <= maxLen) return text;
    return text.slice(0, maxLen).trimEnd() + "\u2026";
  };

  return (
    <div className="flex flex-1 flex-col max-w-2xl mx-auto w-full animate-fade-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-warm-gray-light">
        <h2
          className="text-lg"
          style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
        >
          Your Sessions
        </h2>
        <button
          onClick={onClose}
          className="text-sm text-muted hover:text-sage transition-colors"
          aria-label="Close dashboard"
        >
          Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p
              className="text-muted text-lg mb-3"
              style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
            >
              No sessions yet
            </p>
            <p className="text-muted/60 text-sm max-w-xs">
              Your journey begins with your first conversation.
            </p>
            <button
              onClick={onClose}
              className="mt-6 text-sm text-sage hover:text-sage/80 transition-colors underline underline-offset-4"
            >
              Start a session
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="border border-warm-gray-light rounded-xl p-4 hover:border-warm-gray transition-colors"
              >
                {/* Top row: date, duration, exchanges */}
                <div className="flex items-center gap-3 text-xs text-muted mb-2">
                  <span>{formatDate(session.date)}</span>
                  <span className="text-warm-gray">|</span>
                  <span>{formatDuration(session.duration)}</span>
                  <span className="text-warm-gray">|</span>
                  <span>{session.exchangeCount} exchanges</span>
                </div>

                {/* Intention */}
                {session.intention && (
                  <p className="text-sm leading-snug mb-2">
                    {truncateIntention(session.intention)}
                  </p>
                )}

                {/* Pillar coverage badges */}
                {session.pillarCoverage.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    {session.pillarCoverage.map((pillar) => (
                      <span
                        key={pillar}
                        className="inline-flex items-center gap-1 text-xs text-muted"
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: PILLAR_COLORS[pillar] || "var(--muted)" }}
                        />
                        {PILLAR_LABELS[pillar] || pillar}
                      </span>
                    ))}
                  </div>
                )}

                {/* Pre/post self-report scores */}
                {session.preReport && session.postReport && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mt-2 pt-2 border-t border-warm-gray-light">
                    {SCORE_KEYS.map((key) => {
                      const pre = session.preReport![key];
                      const post = session.postReport![key];
                      const delta = post - pre;
                      return (
                        <span key={key} className="inline-flex items-center gap-1">
                          <span className="capitalize">{key}</span>
                          <span className="text-muted/50">
                            {pre} → {post}
                          </span>
                          <span
                            style={{
                              color: delta > 0 ? "var(--sage)" : delta < 0 ? "#b07070" : "var(--muted)",
                            }}
                          >
                            {delta !== 0 ? formatDelta(delta) : "="}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
