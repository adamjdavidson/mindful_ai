"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import TimelineRow from "@/components/TimelineRow";
import ACIPBar from "@/components/ACIPBar";
import PillarTint from "@/components/PillarTint";
import SelfReport from "@/components/SelfReport";

interface CoachingData {
  content: string;
  pillar: string;
  responseScore?: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  autoScore: number;
  pillar: string;
  coaching: CoachingData | null;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function isPastEvent(event: CalendarEvent): boolean {
  try {
    return new Date(event.end) < new Date();
  } catch {
    return false;
  }
}

export default function CompanionPage() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [telegramConnected, setTelegramConnected] = useState<boolean | null>(null);
  const nowLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchEvents() {
      try {
        const res = await fetch("/api/calendar/events");
        if (res.status === 403) {
          const data = await res.json();
          if (data.error === "needs_reconnect") {
            setError("needs_reconnect");
            return;
          }
        }
        if (!res.ok) {
          setError("Failed to load events");
          return;
        }
        const data = await res.json();
        setEvents(data.events ?? []);
      } catch {
        setError("Failed to load events");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();

    // Check Telegram status
    fetch("/api/telegram/status")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setTelegramConnected(data.connected); })
      .catch(() => {});
  }, [status]);

  // Auto-scroll to "now" line
  useEffect(() => {
    if (nowLineRef.current) {
      nowLineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [events]);

  // Compute pillar counts for ACIPBar
  const pillarCounts = events.reduce<Record<string, number>>((acc, ev) => {
    if (ev.coaching?.pillar) {
      acc[ev.coaching.pillar] = (acc[ev.coaching.pillar] ?? 0) + 1;
    }
    return acc;
  }, {});

  // Unauthenticated users are redirected to /login by middleware.
  // Loading state (also covers brief "unauthenticated" before session resolves)
  if (status !== "authenticated" || loading) {
    return (
      <div className="flex-1 flex flex-col items-center px-4 pt-8">
        <PillarTint tint="neutral" />
        <div className="max-w-[640px] w-full space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div
                className="w-12 h-3 rounded animate-pulse"
                style={{ backgroundColor: "var(--warm-gray-light)" }}
              />
              <div
                className="flex-1 h-4 rounded animate-pulse"
                style={{ backgroundColor: "var(--warm-gray-light)" }}
              />
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div
                    key={j}
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: "var(--warm-gray-light)" }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <SelfReport />
      </div>
    );
  }

  // Needs reconnect — sign out and back in to refresh calendar tokens
  if (error === "needs_reconnect") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <PillarTint tint="neutral" />
        <div className="max-w-[640px] w-full text-center space-y-6">
          <p className="font-sans text-lg text-muted">
            Your calendar connection needs to be refreshed. Please sign out and sign back in.
          </p>
        </div>
        <SelfReport />
      </div>
    );
  }

  // Other errors
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <PillarTint tint="neutral" />
        <p className="text-muted text-sm">{error}</p>
        <SelfReport />
      </div>
    );
  }

  // Empty state — rest day
  if (events.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <PillarTint tint="neutral" />
        <div className="max-w-[640px] w-full text-center space-y-4">
          <p className="text-4xl">&#127807;</p>
          <p className="font-sans text-lg text-muted">
            A quiet day. No events on your calendar.
          </p>
          <p className="font-sans text-sm text-muted italic">
            Rest is not idleness.
          </p>
        </div>
        <SelfReport />
      </div>
    );
  }

  // Handle stress score change
  function handleStressChange(eventId: string, score: number) {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === eventId ? { ...ev, autoScore: score } : ev
      )
    );
    // Persist to backend (fire and forget)
    fetch("/api/companion/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, stress: score }),
    }).catch(() => {});
  }

  // Find the split point between past and future events
  const nowIndex = events.findIndex((ev) => !isPastEvent(ev));
  const showNowLine = nowIndex > 0 || (nowIndex === -1 && events.length > 0);

  return (
    <div className="flex-1 flex flex-col items-center px-4 pt-6 pb-20">
      <PillarTint tint="neutral" />
      <div className="max-w-[640px] w-full space-y-0">
        {telegramConnected === false && (
          <a
            href="/settings"
            className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg text-sm transition-opacity hover:opacity-80"
            style={{
              backgroundColor: "rgba(122, 138, 110, 0.08)",
              color: "var(--muted)",
            }}
          >
            <span className="text-lg">💬</span>
            <span>
              Connect Telegram to get gentle coaching prompts before your meetings
            </span>
            <span className="ml-auto text-xs" style={{ color: "var(--sage)" }}>
              Set up →
            </span>
          </a>
        )}
        {events.map((event, i) => {
          const past = isPastEvent(event);
          const insertNowBefore =
            nowIndex === i ||
            (nowIndex === -1 && i === events.length - 1 && !past);

          return (
            <div key={event.id}>
              {insertNowBefore && nowIndex === i && (
                <div
                  ref={nowLineRef}
                  className="flex items-center gap-2 py-2"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: "var(--sage)" }}
                  />
                  <div
                    className="flex-1 h-px"
                    style={{ backgroundColor: "rgba(122, 138, 110, 0.4)" }}
                  />
                  <span className="text-xs text-muted shrink-0">now</span>
                </div>
              )}
              <TimelineRow
                time={formatTime(event.start)}
                title={event.title}
                stressScore={event.autoScore}
                isPast={past}
                coaching={event.coaching}
                onStressChange={(score) => handleStressChange(event.id, score)}
              />
            </div>
          );
        })}
        {/* Now line at the end if all events are past */}
        {nowIndex === -1 && events.length > 0 && (
          <div ref={nowLineRef} className="flex items-center gap-2 py-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: "var(--sage)" }}
            />
            <div
              className="flex-1 h-px"
              style={{ backgroundColor: "rgba(122, 138, 110, 0.4)" }}
            />
            <span className="text-xs text-muted shrink-0">now</span>
          </div>
        )}

        {/* ACIP pillar bar */}
        <div className="pt-6">
          <ACIPBar counts={pillarCounts} />
        </div>
      </div>
      <SelfReport />
    </div>
  );
}
