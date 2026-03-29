"use client";

import { useState } from "react";

interface TokenBudgetBannerProps {
  tokensUsed: number;
  tokenBudget: number;
  warningReached: boolean;
  budgetExceeded: boolean;
  hasOwnKey: boolean;
  onKeySubmitted?: () => void;
}

export default function TokenBudgetBanner({
  tokensUsed,
  tokenBudget,
  warningReached,
  budgetExceeded,
  hasOwnKey,
  onKeySubmitted,
}: TokenBudgetBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  if (hasOwnKey) return null;

  const pct = Math.round((tokensUsed / tokenBudget) * 100);

  // Gate mode: budget exceeded
  if (budgetExceeded) {
    return (
      <div className="px-4 py-6 space-y-4">
        <p className="font-sans font-medium text-sm">
          You&apos;ve used your free sessions
        </p>
        <p className="text-sm text-muted leading-relaxed">
          To keep going, add your own Anthropic API key below. It takes about 2
          minutes to set up.
        </p>
        <p className="text-xs text-muted">
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
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 text-sm rounded-lg border bg-transparent"
              style={{ borderColor: "var(--border)" }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-foreground"
              style={{ minWidth: "44px", minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <button
            onClick={async () => {
              setSaveStatus("saving");
              try {
                const res = await fetch("/api/settings/api-key", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ apiKey }),
                });
                if (res.ok) {
                  setSaveStatus("saved");
                  onKeySubmitted?.();
                } else {
                  setSaveStatus("error");
                }
              } catch {
                setSaveStatus("error");
              }
              setTimeout(() => setSaveStatus("idle"), 4000);
            }}
            disabled={saveStatus === "saving" || !apiKey.trim()}
            className="text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            style={{
              backgroundColor:
                saveStatus === "saved" ? "var(--sage)" : "var(--foreground)",
              color: "var(--background)",
              opacity: saveStatus === "saving" || !apiKey.trim() ? 0.5 : 1,
            }}
          >
            {saveStatus === "idle" && "Save key"}
            {saveStatus === "saving" && "Validating..."}
            {saveStatus === "saved" && "Key saved!"}
            {saveStatus === "error" && "Invalid key"}
          </button>
        </div>
        <p className="text-xs text-muted">
          Or manage your key in{" "}
          <a
            href="/settings"
            className="underline hover:text-foreground transition-colors"
          >
            Settings →
          </a>
        </p>
      </div>
    );
  }

  // Warning mode: approaching limit
  if (warningReached && !dismissed) {
    return (
      <div
        className="flex items-center justify-between px-4 py-2 text-sm"
        style={{
          backgroundColor: "rgba(180, 140, 60, 0.1)",
          color: "var(--foreground)",
        }}
      >
        <span>
          You&apos;ve used {pct}% of your free tokens.{" "}
          <a
            href="/settings"
            className="underline hover:text-foreground transition-colors"
          >
            Add your API key
          </a>{" "}
          to keep chatting.
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="ml-3 hover:text-foreground transition-colors"
          style={{ minWidth: "44px", minHeight: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  return null;
}
