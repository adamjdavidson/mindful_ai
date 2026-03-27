"use client";

import { useState, useEffect, useRef } from "react";
import BreathingCircle from "./BreathingCircle";

interface IntentionScreenProps {
  onBegin: (intention: string) => void;
  onMeditationRequest?: (minutes: number) => void;
  onShowHistory?: () => void;
  /** Set to "intention" after meditation completes to skip breathing + meditation question */
  startPhase?: "breathing" | "intention";
}

const suggestions = [
  { label: "Learn something new", followUp: "What do you want to learn?" },
  { label: "Get help with a problem", followUp: "Tell me about the problem." },
  { label: "Explore an idea", followUp: "What idea are you exploring?" },
  { label: "Think through a decision", followUp: "What decision are you facing?" },
  { label: "Process my thoughts", followUp: "What's on your mind?" },
];

const durationOptions = [
  { value: 0, label: "Skip" },
  { value: 15 / 60, label: "15 sec" },
  { value: 40 / 60, label: "40 sec" },
  { value: 1, label: "1 min" },
];

export default function IntentionScreen({
  onBegin,
  onMeditationRequest,
  onShowHistory,
  startPhase = "breathing",
}: IntentionScreenProps) {
  const [intention, setIntention] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<number>(0);
  const [phase, setPhase] = useState<"breathing" | "meditation" | "intention">(startPhase);
  const [prompt, setPrompt] = useState("What's your intention for this conversation?");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when entering intention phase
  useEffect(() => {
    if (phase === "intention") {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [phase]);

  // Phase 1: Breathing for a full cycle, then show meditation question
  useEffect(() => {
    if (startPhase !== "breathing") return;
    const timer = setTimeout(() => setPhase("meditation"), 10000);
    return () => clearTimeout(timer);
  }, [startPhase]);

  const handleDurationSelect = (value: number) => {
    setSelectedDuration(value);
    if (value > 0 && onMeditationRequest) {
      // Trigger meditation in parent, parent will re-render with startPhase="intention" after
      onMeditationRequest(value);
    } else {
      // Skip meditation, go straight to intention
      setPhase("intention");
    }
  };

  const handleSuggestionClick = (suggestion: typeof suggestions[number]) => {
    setPrompt(suggestion.followUp);
    setIntention("");
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleSubmit = () => {
    if (!intention.trim()) return;
    onBegin(intention.trim());
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 animate-fade-in">
      <div className="flex flex-col items-center gap-10 max-w-md w-full">
        <BreathingCircle size={140} showLabel={phase === "breathing"} />

        {/* Phase 2: Meditation question */}
        {phase === "meditation" && (
          <div className="flex flex-col items-center gap-6 w-full animate-fade-in" data-tour-id="meditation-option">
            <p
              className="text-lg text-center leading-relaxed"
              style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
            >
              Would you like to begin with a guided meditation?
            </p>
            <div className="flex gap-3">
              {durationOptions.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handleDurationSelect(opt.value)}
                  className="px-4 py-2 rounded-full text-sm border border-warm-gray text-muted hover:border-sage hover:text-sage transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Phase 3: Intention */}
        {phase === "intention" && (
          <div className="flex flex-col items-center gap-8 w-full animate-fade-in" data-tour-id="intention-setting">
            <h1
              className="text-2xl text-center leading-relaxed"
              style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
            >
              {prompt}
            </h1>

            <div className="w-full">
              <textarea
                ref={textareaRef}
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="I want to..."
                rows={2}
                className="w-full bg-transparent border-b-2 border-warm-gray focus:border-sage outline-none resize-none text-lg py-3 px-1 placeholder:text-muted/50 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>

            {!intention && prompt === "What's your intention for this conversation?" && (
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSuggestionClick(s)}
                    className="px-4 py-2 rounded-full text-sm border border-warm-gray text-muted hover:border-sage hover:text-sage transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {intention && (
              <button
                onClick={handleSubmit}
                className="px-8 py-3 rounded-full bg-sage text-white text-base hover:bg-sage/90 transition-colors animate-fade-in"
              >
                Begin
              </button>
            )}
          </div>
        )}
      </div>

      {onShowHistory && phase !== "breathing" && (
        <button
          onClick={onShowHistory}
          className="mt-8 text-sm text-muted/50 hover:text-muted transition-colors"
        >
          Past sessions
        </button>
      )}
    </div>
  );
}
