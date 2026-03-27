"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [polling, setPolling] = useState(false);

  const userId = (session?.user as { id?: string } | undefined)?.id;

  const checkTelegramStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/status");
      if (res.ok) {
        const data = await res.json();
        setTelegramConnected(data.connected);
        if (data.connected) setPolling(false);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initial check
  useEffect(() => {
    if (status === "authenticated") checkTelegramStatus();
  }, [status, checkTelegramStatus]);

  // Poll every 3s while waiting for connection
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(checkTelegramStatus, 3000);
    return () => clearInterval(interval);
  }, [polling, checkTelegramStatus]);

  function handleRerunTour() {
    localStorage.removeItem("mindful-tour-complete");
    window.location.href = "/";
  }

  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted text-sm">Please sign in to view settings.</p>
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="flex-1 flex flex-col items-center px-4 pt-10 pb-20">
      <div className="max-w-[480px] w-full space-y-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-muted hover:text-foreground transition-colors"
          >
            ← Back
          </a>
          <h1 className="font-sans text-2xl font-semibold tracking-tight">
            Settings
          </h1>
        </div>

        {/* Profile section */}
        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-muted">
            Account
          </h2>
          <div className="flex items-center gap-4">
            {user?.image && (
              <img
                src={user.image}
                alt=""
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              <p className="font-sans font-medium">{user?.name ?? "User"}</p>
              <p className="text-sm text-muted">{user?.email}</p>
            </div>
          </div>
        </section>

        {/* Telegram section */}
        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-muted">
            Telegram
          </h2>

          {telegramConnected ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: "var(--sage)" }}
              />
              <span className="text-sm" style={{ color: "var(--sage)" }}>
                Telegram connected
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted leading-relaxed">
                Connect Telegram to receive coaching prompts before your
                calendar events and log reflections by replying with a score.
              </p>
              <a
                href={`https://t.me/ai_mindful_bot?start=${userId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPolling(true)}
                className="inline-block px-5 py-2 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: "var(--sage)",
                  color: "var(--background)",
                }}
              >
                Connect Telegram
              </a>
              <p className="text-xs text-muted italic">
                Tap the link, then tap Start in Telegram.
              </p>
            </div>
          )}
        </section>

        {/* Actions */}
        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-muted">
            More
          </h2>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleRerunTour}
              className="text-left text-sm transition-colors hover:text-foreground text-muted"
            >
              Re-run feature tour
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-left text-sm transition-colors hover:text-foreground text-muted"
            >
              Sign out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
