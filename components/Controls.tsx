"use client";

import { useState, useEffect, useRef } from "react";

type SoundOption = "off" | "rain" | "bowls";

interface ControlsProps {
  onStartTour?: () => void;
}

export default function Controls({ onStartTour }: ControlsProps = {}) {
  const [isDark, setIsDark] = useState(false);
  const [sound, setSound] = useState<SoundOption>("off");
  const [isOpen, setIsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Check system preference on mount
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const saved = localStorage.getItem("mindful-dark-mode");
    const dark = saved ? saved === "true" : prefersDark;
    setIsDark(dark);
    if (dark) {
      document.documentElement.classList.add("dark");
    }

    const savedSound = localStorage.getItem("mindful-sound") as SoundOption;
    if (savedSound) setSound(savedSound);
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("mindful-dark-mode", String(next));
    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const changeSound = (option: SoundOption) => {
    setSound(option);
    localStorage.setItem("mindful-sound", option);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (option !== "off") {
      const audio = new Audio(`/sounds/${option}.mp3`);
      audio.loop = true;
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Browser may block autoplay
      });
      audioRef.current = audio;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-warm-gray-light border border-warm-gray flex items-center justify-center text-muted hover:text-foreground transition-colors"
        aria-label="Settings"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-14 right-0 w-56 bg-background border border-warm-gray rounded-xl p-4 shadow-lg animate-fade-in">
          {/* How it works */}
          <button
            onClick={() => {
              if (onStartTour) {
                onStartTour();
              } else {
                // Dispatch custom event for cross-component communication
                window.dispatchEvent(new CustomEvent("mindful-start-tour"));
              }
              setIsOpen(false);
            }}
            className="flex items-center gap-2 w-full text-sm text-foreground hover:text-sage transition-colors mb-3 pb-3 border-b border-warm-gray"
          >
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-xs leading-none">?</span>
            How it works
          </button>

          {/* Dark mode */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-foreground">Dark mode</span>
            <button
              onClick={toggleDark}
              className={`w-10 h-6 rounded-full transition-colors relative ${
                isDark ? "bg-sage" : "bg-warm-gray"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  isDark ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Ambient sound */}
          <div>
            <span className="text-sm text-foreground block mb-2">
              Ambient sound
            </span>
            <div className="flex gap-2">
              {(["off", "rain", "bowls"] as SoundOption[]).map((option) => (
                <button
                  key={option}
                  onClick={() => changeSound(option)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors capitalize ${
                    sound === option
                      ? "border-sage bg-sage-light text-sage"
                      : "border-warm-gray text-muted hover:border-sage"
                  }`}
                >
                  {option === "off" ? "Silence" : option}
                </button>
              ))}
            </div>
          </div>

          {/* Settings link */}
          <a
            href="/settings"
            className="flex items-center gap-2 w-full text-sm text-foreground hover:text-sage transition-colors mt-3 pt-3 border-t border-warm-gray"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Account & Telegram
          </a>
        </div>
      )}
    </div>
  );
}
