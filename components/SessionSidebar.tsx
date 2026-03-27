"use client";

import { useState, useEffect, useCallback } from "react";

interface ChatSessionEntry {
  id: string;
  intention: string | null;
  summary: string | null;
  pillarScores: Record<string, number> | null;
  startedAt: string;
  endedAt: string | null;
  _count: { messages: number };
}

const PILLAR_COLORS: Record<string, string> = {
  awareness: "bg-blue-400",
  connection: "bg-rose-400",
  insight: "bg-violet-400",
  purpose: "bg-amber-400",
};

interface SessionSidebarProps {
  currentSessionId: string | null;
  onNewSession: () => void;
}

export default function SessionSidebar({
  currentSessionId,
  onNewSession,
}: SessionSidebarProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      // Silently fail -- sidebar is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSessions();
    }
  }, [open, fetchSessions]);

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const truncate = (text: string | null, max: number) => {
    if (!text) return "Untitled session";
    if (text.length <= max) return text;
    return text.slice(0, max).trimEnd() + "\u2026";
  };

  const activePillars = (scores: Record<string, number> | null) => {
    if (!scores) return [];
    return Object.entries(scores)
      .filter(([, v]) => v > 0)
      .map(([k]) => k);
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="fixed top-3 left-3 z-50 w-9 h-9 flex items-center justify-center rounded-full border border-warm-gray bg-background/80 backdrop-blur-sm text-muted hover:text-sage hover:border-sage transition-colors"
        aria-label={open ? "Close session history" : "Open session history"}
        title="Session history"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {/* Backdrop (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-72 bg-background border-r border-warm-gray-light flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-14 pb-3 border-b border-warm-gray-light">
          <h2
            className="text-sm font-medium text-muted"
            style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
          >
            Sessions
          </h2>
          <button
            onClick={() => {
              onNewSession();
              setOpen(false);
            }}
            className="text-xs px-3 py-1.5 rounded-full border border-warm-gray text-muted hover:border-sage hover:text-sage transition-colors"
          >
            + New
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-xs text-muted/50">Loading...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <p className="text-muted/60 text-xs leading-relaxed">
                Your past sessions will appear here
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sessions.map((s) => {
                const isCurrent = s.id === currentSessionId;
                const isExpanded = expandedId === s.id;
                const pillars = activePillars(
                  s.pillarScores as Record<string, number> | null
                );

                return (
                  <div key={s.id}>
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : s.id)
                      }
                      className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                        isCurrent
                          ? "border border-sage/40 bg-sage-light/30"
                          : "border border-transparent hover:bg-warm-gray-light/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm leading-snug truncate flex-1">
                          {truncate(s.intention, 40)}
                        </span>
                        <span className="text-[10px] text-muted/50 whitespace-nowrap mt-0.5">
                          {formatDate(s.startedAt)}
                        </span>
                      </div>

                      {/* Pillar dots + message count */}
                      <div className="flex items-center gap-2 mt-1.5">
                        {pillars.length > 0 && (
                          <div className="flex items-center gap-1">
                            {pillars.map((p) => (
                              <span
                                key={p}
                                className={`inline-block w-1.5 h-1.5 rounded-full ${
                                  PILLAR_COLORS[p] ?? "bg-muted"
                                }`}
                                title={p}
                              />
                            ))}
                          </div>
                        )}
                        <span className="text-[10px] text-muted/40">
                          {s._count.messages} msg{s._count.messages !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </button>

                    {/* Expanded summary */}
                    {isExpanded && s.summary && (
                      <div className="px-3 pb-2 pt-1 animate-fade-in">
                        <p className="text-xs text-muted/70 leading-relaxed italic">
                          {s.summary}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
