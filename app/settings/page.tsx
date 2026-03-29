"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [polling, setPolling] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Budget & API key state
  const [tokensUsed, setTokensUsed] = useState(0);
  const [tokenBudget, setTokenBudget] = useState(50000);
  const [hasKey, setHasKey] = useState(false);
  const [preferredModel, setPreferredModel] = useState('claude-sonnet-4-6-20250627');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [modelInput, setModelInput] = useState('claude-sonnet-4-6-20250627');
  const [keySaveStatus, setKeySaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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

  const fetchUsageAndKey = useCallback(async () => {
    try {
      const [usageRes, keyRes] = await Promise.all([
        fetch('/api/settings/usage'),
        fetch('/api/settings/api-key'),
      ]);
      if (usageRes.ok) {
        const data = await usageRes.json();
        setTokensUsed(data.tokensUsed);
        setTokenBudget(data.tokenBudget);
      }
      if (keyRes.ok) {
        const data = await keyRes.json();
        setHasKey(data.hasKey);
        setPreferredModel(data.preferredModel);
        setModelInput(data.preferredModel);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initial check
  useEffect(() => {
    if (status === "authenticated") {
      checkTelegramStatus();
      fetchUsageAndKey();
    }
  }, [status, checkTelegramStatus, fetchUsageAndKey]);

  // Poll every 3s while waiting for connection
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(checkTelegramStatus, 3000);
    return () => clearInterval(interval);
  }, [polling, checkTelegramStatus]);

  async function handleSaveKey() {
    setKeySaveStatus('saving');
    try {
      const res = await fetch('/api/settings/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput, preferredModel: modelInput }),
      });
      if (res.ok) {
        setKeySaveStatus('saved');
        setHasKey(true);
        setPreferredModel(modelInput);
        setApiKeyInput('');
      } else {
        setKeySaveStatus('error');
      }
    } catch {
      setKeySaveStatus('error');
    }
    setTimeout(() => setKeySaveStatus('idle'), 4000);
  }

  async function handleRemoveKey() {
    try {
      const res = await fetch('/api/settings/api-key', { method: 'DELETE' });
      if (res.ok) {
        setHasKey(false);
        setPreferredModel('claude-sonnet-4-6-20250627');
        setModelInput('claude-sonnet-4-6-20250627');
      }
    } catch {
      // ignore
    }
  }

  async function handleModelChange(model: string) {
    setModelInput(model);
    if (hasKey) {
      // Update model preference via PATCH-style update
      try {
        await fetch('/api/settings/api-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferredModel: model }),
        });
        setPreferredModel(model);
      } catch {
        // ignore
      }
    }
  }

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
  const usagePct = tokenBudget > 0 ? Math.round((tokensUsed / tokenBudget) * 100) : 0;

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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: "var(--sage)" }}
                />
                <span className="text-sm" style={{ color: "var(--sage)" }}>
                  Telegram connected
                </span>
              </div>
              <button
                onClick={async () => {
                  setTestStatus('sending');
                  try {
                    const res = await fetch('/api/telegram/test', { method: 'POST' });
                    if (res.ok) {
                      setTestStatus('sent');
                      setTimeout(() => setTestStatus('idle'), 4000);
                    } else {
                      setTestStatus('error');
                      setTimeout(() => setTestStatus('idle'), 4000);
                    }
                  } catch {
                    setTestStatus('error');
                    setTimeout(() => setTestStatus('idle'), 4000);
                  }
                }}
                disabled={testStatus === 'sending'}
                className="text-sm px-4 py-1.5 rounded-lg transition-colors border"
                style={{
                  borderColor: 'var(--border)',
                  color: testStatus === 'sent' ? 'var(--sage)' : 'var(--foreground)',
                  opacity: testStatus === 'sending' ? 0.6 : 1,
                }}
              >
                {testStatus === 'idle' && 'Send test message'}
                {testStatus === 'sending' && 'Sending...'}
                {testStatus === 'sent' && 'Sent! Check Telegram.'}
                {testStatus === 'error' && 'Failed — try again'}
              </button>
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

        {/* Usage section */}
        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-muted">
            Usage
          </h2>
          <div className="space-y-2">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--border)" }}
              role="progressbar"
              aria-valuenow={tokensUsed}
              aria-valuemax={tokenBudget}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  backgroundColor: "var(--sage)",
                  width: `${Math.min(usagePct, 100)}%`,
                }}
              />
            </div>
            <p className="text-sm text-muted">
              {tokensUsed.toLocaleString()} / {tokenBudget.toLocaleString()} tokens
              {hasKey && " (using your key)"}
            </p>
          </div>
        </section>

        {/* API Key section */}
        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-muted">
            API Key
          </h2>

          {hasKey ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: "var(--sage)" }}
                />
                <span className="text-sm" style={{ color: "var(--sage)" }}>
                  API key connected
                </span>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={modelInput}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border bg-transparent"
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="claude-sonnet-4-6-20250627">
                    Sonnet (recommended)
                  </option>
                  <option value="claude-opus-4-6">Opus</option>
                </select>
                <button
                  onClick={handleRemoveKey}
                  className="text-sm transition-colors hover:text-foreground text-muted"
                >
                  Remove key
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-transparent min-w-0"
                    style={{ borderColor: "var(--border)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-foreground flex items-center justify-center"
                    style={{ minWidth: "44px", minHeight: "44px" }}
                  >
                    {showKey ? "Hide" : "Show"}
                  </button>
                </div>
                <select
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg border bg-transparent"
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="claude-sonnet-4-6-20250627">Sonnet</option>
                  <option value="claude-opus-4-6">Opus</option>
                </select>
              </div>
              <button
                onClick={handleSaveKey}
                disabled={keySaveStatus === 'saving' || !apiKeyInput.trim()}
                className="text-sm px-4 py-1.5 rounded-lg transition-colors border"
                style={{
                  borderColor: 'var(--border)',
                  color: keySaveStatus === 'saved' ? 'var(--sage)' : keySaveStatus === 'error' ? '#c44' : 'var(--foreground)',
                  opacity: keySaveStatus === 'saving' || !apiKeyInput.trim() ? 0.5 : 1,
                }}
              >
                {keySaveStatus === 'idle' && 'Save key'}
                {keySaveStatus === 'saving' && 'Validating...'}
                {keySaveStatus === 'saved' && 'Key saved!'}
                {keySaveStatus === 'error' && 'Invalid key — try again'}
              </button>
              <p className="text-xs text-muted italic">
                Get your key at{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  console.anthropic.com → API Keys
                </a>
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
