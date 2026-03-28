"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
    // All-day events come as "YYYY-MM-DD" (no T, no time component).
    // Don't try to format a time for these.
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return "All day";
    }
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function isPastEvent(event: CalendarEvent): boolean {
  try {
    // All-day events ("YYYY-MM-DD"): treat as current (not past) if end date is today or later
    if (/^\d{4}-\d{2}-\d{2}$/.test(event.end)) {
      const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local tz
      return event.end < today;
    }
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
  const [annotations, setAnnotations] = useState<Record<string, { stress?: number; note?: string }>>({});
  const nowLineRef = useRef<HTMLDivElement>(null);

  // Save annotation to server (memoized to prevent re-render cascades)
  const saveAnnotation = useCallback(async (eventId: string, eventTitle: string, data: { stress?: number; note?: string }) => {
    setAnnotations(prev => ({ ...prev, [eventId]: { ...prev[eventId], ...data } }));
    try {
      await fetch("/api/companion/annotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, eventTitle, ...data }),
      });
    } catch {
      // silent fail, annotation is already in local state
    }
  }, []);

  useEffect(() => {
    console.log("[companion] useEffect fired, status:", status, "session:", !!session);
    if (status !== "authenticated") return;

    async function fetchEvents() {
      const t0 = performance.now();
      console.log("[companion] fetchEvents started");
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`/api/calendar/events?tz=${encodeURIComponent(tz)}`);
        console.log("[companion] calendar API responded in", Math.round(performance.now() - t0), "ms, status:", res.status);
        if (res.status === 403) {
          const data = await res.json();
          if (data.error === "needs_reconnect") {
            console.log("[companion] needs_reconnect");
            setError("needs_reconnect");
            return;
          }
        }
        if (!res.ok) {
          const text = await res.text();
          console.error("[companion] calendar API error:", res.status, text);
          // Check for scope/auth errors — treat as needs_reconnect
          if (text.includes("insufficient authentication scopes") || text.includes("invalid_grant")) {
            setError("needs_reconnect");
          } else {
            setError("Failed to load events");
          }
          return;
        }
        const data = await res.json();
        console.log("[companion] got", data.events?.length ?? 0, "events in", Math.round(performance.now() - t0), "ms");
        setEvents(data.events ?? []);
      } catch (err) {
        console.error("[companion] fetchEvents exception:", err);
        setError("Failed to load events");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();

    // Check Telegram status
    const tTel = performance.now();
    fetch("/api/telegram/status")
      .then((res) => {
        console.log("[companion] telegram status responded in", Math.round(performance.now() - tTel), "ms");
        return res.ok ? res.json() : null;
      })
      .then((data) => { if (data) setTelegramConnected(data.connected); })
      .catch((err) => console.error("[companion] telegram status error:", err));
  }, [status]);

  // Auto-scroll to "now" line
  useEffect(() => {
    if (nowLineRef.current) {
      nowLineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [events]);

  // Load existing annotations
  useEffect(() => {
    if (status !== "authenticated") return;
    const t0 = performance.now();
    console.log("[companion] fetching annotations");
    fetch("/api/companion/annotations")
      .then((res) => {
        console.log("[companion] annotations responded in", Math.round(performance.now() - t0), "ms, status:", res.status);
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (data?.annotations) {
          console.log("[companion] loaded", Object.keys(data.annotations).length, "annotations");
          setAnnotations(data.annotations);
        }
      })
      .catch((err) => console.error("[companion] annotations error:", err));
  }, [status]);

  // Compute pillar counts for ACIPBar (memoized to prevent new object on every render)
  const pillarCounts = useMemo(() => events.reduce<Record<string, number>>((acc, ev) => {
    if (ev.coaching?.pillar) {
      acc[ev.coaching.pillar] = (acc[ev.coaching.pillar] ?? 0) + 1;
    }
    return acc;
  }, {}), [events]);

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
                stressScore={annotations[event.id]?.stress ?? event.autoScore}
                isPast={past}
                note={annotations[event.id]?.note}
                coaching={event.coaching}
                onStressChange={(score) => saveAnnotation(event.id, event.title, { stress: score })}
                onNoteChange={(note) => saveAnnotation(event.id, event.title, { note })}
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
