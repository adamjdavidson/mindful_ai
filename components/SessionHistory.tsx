"use client";

import { useState, useEffect } from "react";
import { SessionSummary, getSessionHistory } from "@/lib/session";

interface SessionHistoryProps {
  onClose: () => void;
}

export default function SessionHistory({ onClose }: SessionHistoryProps) {
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
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-1 flex-col max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-warm-gray-light">
        <h2
          className="text-lg"
          style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
        >
          Past Sessions
        </h2>
        <button
          onClick={onClose}
          className="text-sm text-muted hover:text-sage transition-colors"
        >
          New session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted text-lg mb-2">No sessions yet</p>
            <p className="text-muted/60 text-sm">
              Your conversation history will appear here
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="border border-warm-gray-light rounded-xl p-4 hover:border-warm-gray transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <p className="text-base font-medium leading-snug">
                    {session.intention}
                  </p>
                  <span className="text-xs text-muted whitespace-nowrap">
                    {formatDate(session.date)}
                  </span>
                </div>
                {session.takeaway && (
                  <p className="text-sm text-muted italic mb-2">
                    &ldquo;{session.takeaway}&rdquo;
                  </p>
                )}
                <div className="flex gap-4 text-xs text-muted/60">
                  <span>{formatDuration(session.duration)}</span>
                  <span>{session.exchangeCount} exchanges</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
