"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import IntentionScreen from "@/components/IntentionScreen";
import ChatInterface from "@/components/ChatInterface";
import MeditationScreen from "@/components/MeditationScreen";
import ReflectionScreen from "@/components/ReflectionScreen";
import SessionHistory from "@/components/SessionHistory";
import BreathingCircle from "@/components/BreathingCircle";
import SelfReport from "@/components/SelfReport";
import MindfulOverlay from "@/components/MindfulOverlay";
import PillarTint from "@/components/PillarTint";
import {
  SessionPhase,
  Message,
  createSession,
  saveSessionSummary,
  SessionData,
} from "@/lib/session";
import {
  SessionState,
  shouldShowOverlay,
  getActiveTint,
  getPromptModifiers,
  getPacingMultiplier,
} from "@/lib/interventions";
import {
  TelemetryData,
  SelfReportData,
  createTelemetry,
  recordMessage,
  recordMeditation,
  recordReflection,
  finalizeTelemetry,
} from "@/lib/telemetry";

export default function Home() {
  const [session, setSession] = useState<SessionData>(createSession);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [meditationText, setMeditationText] = useState("");
  const [isMeditationLoading, setIsMeditationLoading] = useState(false);
  const [reflectionText, setReflectionText] = useState("");
  const [isReflectionLoading, setIsReflectionLoading] = useState(false);
  const [showClosing, setShowClosing] = useState(false);
  const [postMeditation, setPostMeditation] = useState(false); // true after pre-conversation meditation
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryData>(createTelemetry);
  const [recentMessageTimestamps, setRecentMessageTimestamps] = useState<number[]>([]);
  const [overlayDismissed, setOverlayDismissed] = useState<number>(0);
  const [gratitudeShown, setGratitudeShown] = useState(false);
  const [showValuesAction, setShowValuesAction] = useState(false);

  const exchangeCountRef = useRef(0);
  const lastRetryContentRef = useRef<string>("");

  const setPhase = useCallback((phase: SessionPhase) => {
    setSession((prev) => ({ ...prev, phase }));
  }, []);

  // Derive SessionState for intervention engine
  const sessionState: SessionState = useMemo(() => ({
    exchangeCount: session.exchangeCount,
    lastMessageTimestamp: recentMessageTimestamps[recentMessageTimestamps.length - 1] || 0,
    recentMessageTimestamps,
    phase: session.phase,
    intention: session.intention,
    activeInterventions: gratitudeShown ? [4] : [],
  }), [session.exchangeCount, session.phase, session.intention, recentMessageTimestamps, gratitudeShown]);

  const activeTint = useMemo(() => getActiveTint(sessionState), [sessionState]);
  const overlayIntervention = useMemo(() => shouldShowOverlay(sessionState), [sessionState]);
  const promptModifiers = useMemo(() => getPromptModifiers(sessionState), [sessionState]);
  const pacingMultiplier = useMemo(() => getPacingMultiplier(sessionState), [sessionState]);

  const fetchMeditation = async (
    intention: string,
    context: string,
    durationMinutes: number,
    type: "opening" | "mid" | "reflection" = "opening",
    pillar?: string
  ) => {
    try {
      const res = await fetch("/api/meditation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intention,
          context,
          durationMinutes,
          type: type === "reflection" ? "reflection" : "meditation",
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          pillar,
        }),
      });
      const data = await res.json();
      return data.meditation;
    } catch {
      return "Take a moment to settle in.\n\nNotice your breathing.\n\nLet your attention rest here.\n\nWhen you feel ready, begin.";
    }
  };

  // Called when user picks a meditation duration > 0 (before intention is set)
  const handleMeditationRequest = async (minutes: number) => {
    setIsMeditationLoading(true);
    const text = await fetchMeditation("", "", minutes);
    setMeditationText(text);
    setIsMeditationLoading(false);
  };

  // Called when user submits their intention
  const handleBegin = async (intention: string) => {
    setSession((prev) => ({ ...prev, intention }));
    setPostMeditation(false);
    setPhase("conversation");
  };

  const handleMeditationComplete = () => {
    setMeditationText("");
    setTelemetry((prev) => recordMeditation(prev, true));
    // Go back to IntentionScreen for intention setting
    setPostMeditation(true);
  };

  const sendMessage = async (content: string) => {
    setError(null);
    lastRetryContentRef.current = content;

    const userMessage: Message = {
      role: "user",
      content,
      timestamp: Date.now(),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    // Record telemetry and timestamps
    setTelemetry((prev) => recordMessage(prev, content));
    setRecentMessageTimestamps((prev) => [...prev.slice(-4), Date.now()]);

    // Intentional pause before responding
    setIsWaiting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsWaiting(false);

    setIsStreaming(true);
    setStreamingText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          intention: session.intention,
          promptModifiers,
        }),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const { text } = JSON.parse(data);
                fullText += text;
                setStreamingText(fullText);
              } catch {
                // skip malformed chunks
              }
            }
          }
        }
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: fullText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingText("");
      setIsStreaming(false);
      exchangeCountRef.current += 1;
      setSession((prev) => ({
        ...prev,
        exchangeCount: exchangeCountRef.current,
      }));
      // Reset overlay dismissed counter so new overlays can show
      setOverlayDismissed((prev) => prev);
    } catch {
      setIsStreaming(false);
      setStreamingText("");
      setError("Something interrupted our connection. Would you like to try again?");
    }
  };

  const handleRetry = () => {
    if (lastRetryContentRef.current) {
      // Remove the last user message (it was already added), then resend
      setMessages((prev) => prev.slice(0, -1));
      setError(null);
      sendMessage(lastRetryContentRef.current);
    }
  };

  const handleMeditationBreak = async () => {
    setIsMeditationLoading(true);
    const recentContext = messages
      .slice(-4)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const text = await fetchMeditation(session.intention, recentContext, 1, "mid");
    setMeditationText(text);
    setIsMeditationLoading(false);
  };

  const handleEndSession = async () => {
    setPhase("reflection");
    setIsReflectionLoading(true);
    const text = await fetchMeditation(
      session.intention,
      "",
      1,
      "reflection"
    );
    setReflectionText(text);
    setIsReflectionLoading(false);
  };

  const handleReflectionComplete = (takeaway: string) => {
    setSession((prev) => ({ ...prev, takeaway }));
    setTelemetry((prev) => recordReflection(prev, takeaway));
    setShowClosing(true);
    setPhase("closing");
    setGratitudeShown(false);
    setShowValuesAction(false);

    // Show gratitude overlay (rose tint) first
    setGratitudeShown(true);

    // After gratitude auto-dismisses, show values-action bridge (amber tint)
    setTimeout(() => {
      setShowValuesAction(true);
    }, 13000);

    // Save session
    const finalTelemetry = finalizeTelemetry(telemetry, session.startedAt);
    const finalSession: SessionData = {
      ...session,
      takeaway,
      messages,
      telemetry: finalTelemetry,
    };
    saveSessionSummary(finalSession);
  };


  const handleNewSession = () => {
    setShowClosing(false);
    setPostMeditation(false);
    setSession(createSession());
    setMessages([]);
    setReflectionText("");
    setMeditationText("");
    setTelemetry(createTelemetry());
    setRecentMessageTimestamps([]);
    setOverlayDismissed(0);
    setGratitudeShown(false);
    setShowValuesAction(false);
    setError(null);
    exchangeCountRef.current = 0;
  };

  const handleOverlayDismiss = () => {
    setOverlayDismissed((prev) => prev + 1);
  };

  const handleAmbientReport = useCallback((data: Partial<SelfReportData>) => {
    // Store the latest ambient readings in session as preReport (before conversation)
    // or postReport (during/after conversation)
    if (session.phase === "arrival") {
      setSession((prev) => ({ ...prev, preReport: data as SelfReportData }));
    } else {
      setSession((prev) => ({ ...prev, postReport: data as SelfReportData }));
    }
  }, [session.phase]);

  // Determine what to show in overlay
  let overlayContent: string | null = null;
  let overlayPillar: "awareness" | "connection" | "insight" | "purpose" | null = null;

  if (showClosing && gratitudeShown && !showValuesAction) {
    overlayContent = "What from this conversation are you grateful for?";
    overlayPillar = "connection";
  } else if (showClosing && showValuesAction) {
    overlayContent = "What's one thing you'll do differently?";
    overlayPillar = "purpose";
  } else if (overlayIntervention && !isStreaming && !isWaiting && session.phase === "conversation") {
    overlayContent = overlayIntervention.content;
    overlayPillar = overlayIntervention.pillar;
  }

  // Ambient self-report dots — visible everywhere, always
  const showAmbientDots = true;

  // Meditation overlay (can appear during arrival or conversation)
  if (meditationText || isMeditationLoading) {
    return (
      <>
        <PillarTint tint={activeTint} />
        {showAmbientDots && <SelfReport onChange={handleAmbientReport} />}
        <MeditationScreen
          text={meditationText}
          isLoading={isMeditationLoading}
          onComplete={handleMeditationComplete}
        />
      </>
    );
  }

  // Reflection screen
  if (session.phase === "reflection") {
    return (
      <>
        <PillarTint tint={activeTint} />
        <SelfReport onChange={handleAmbientReport} />
        <ReflectionScreen
          reflectionText={reflectionText}
          isLoading={isReflectionLoading}
          onComplete={handleReflectionComplete}
        />
      </>
    );
  }

  // Closing screen
  if (showClosing) {
    return (
      <>
        <PillarTint tint={activeTint} />
        <SelfReport onChange={handleAmbientReport} />
        <MindfulOverlay
          content={overlayContent}
          pillar={overlayPillar}
          onDismiss={handleOverlayDismiss}
        />
        <div className="flex flex-1 flex-col items-center justify-center px-6 animate-fade-in gap-8" data-tour-id="session-closing">
          <BreathingCircle size={120} showLabel={false} />
          <p
            className="text-xl text-center max-w-sm leading-relaxed"
            style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
          >
            Thank you for being present.
          </p>
          <button
            onClick={handleNewSession}
            className="mt-4 px-6 py-2.5 rounded-full text-sm border border-warm-gray text-muted hover:border-sage hover:text-sage transition-colors"
          >
            New session
          </button>
        </div>
      </>
    );
  }

  // Session history
  if (showHistory) {
    return (
      <SessionHistory
        onClose={() => setShowHistory(false)}
      />
    );
  }

  // Arrival / Intention screen
  if (session.phase === "arrival") {
    return (
      <>
        <PillarTint tint="neutral" />
        <SelfReport onChange={handleAmbientReport} />
        <IntentionScreen
          onBegin={handleBegin}
          onMeditationRequest={handleMeditationRequest}
          onShowHistory={() => setShowHistory(true)}
          startPhase={postMeditation ? "intention" : "breathing"}
        />
      </>
    );
  }

  // Main conversation
  return (
    <>
      <PillarTint tint={activeTint} />
      <SelfReport onChange={handleAmbientReport} />
      <MindfulOverlay
        content={overlayContent}
        pillar={overlayPillar}
        onDismiss={handleOverlayDismiss}
      />
      <ChatInterface
        intention={session.intention}
        messages={messages}
        onSendMessage={sendMessage}
        onMeditationBreak={handleMeditationBreak}
        onEndSession={handleEndSession}
        streamingText={streamingText}
        isStreaming={isStreaming}
        isWaiting={isWaiting}
        exchangeCount={session.exchangeCount}
        error={error}
        onError={handleRetry}
        pacingMultiplier={pacingMultiplier}
      />
    </>
  );
}
