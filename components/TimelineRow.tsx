"use client";

import { useState } from "react";
import StressIndicator from "./StressIndicator";

interface TimelineRowProps {
  time: string;
  title: string;
  stressScore: number;
  isPast: boolean;
  note?: string;
  coaching?: {
    content: string;
    pillar: string;
    responseScore?: number;
  } | null;
  onStressChange?: (score: number) => void;
  onNoteChange?: (note: string) => void;
}

export default function TimelineRow({
  time,
  title,
  stressScore,
  isPast,
  note,
  coaching,
  onStressChange,
  onNoteChange,
}: TimelineRowProps) {
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState(note || "");

  const hasNote = !!note && note.trim().length > 0;

  function handleSave() {
    if (onNoteChange) onNoteChange(draft.trim());
    setShowModal(false);
  }

  function handleOpen() {
    setDraft(note || "");
    setShowModal(true);
  }

  return (
    <>
      <div className={`flex flex-col gap-0.5 py-2 ${isPast ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted w-12 shrink-0 font-body">
            {time}
          </span>
          <span className="text-sm truncate flex-1">{title}</span>

          {/* Note icon */}
          <button
            onClick={handleOpen}
            className="shrink-0 transition-colors"
            style={{ color: hasNote ? "var(--sage)" : "var(--warm-gray)" }}
            aria-label={hasNote ? "Edit note" : "Add note"}
            title={hasNote ? "Edit note" : "How does this feel?"}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={hasNote ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>

          <StressIndicator
            score={stressScore}
            size={6}
            interactive
            onChange={onStressChange}
          />
        </div>
        {/* Note preview */}
        {hasNote && (
          <button
            onClick={handleOpen}
            className="flex items-start gap-2 ml-15 pl-0.5 text-left w-full"
          >
            <span className="text-xs text-muted italic truncate max-w-[300px]">
              {note}
            </span>
          </button>
        )}

        {coaching && (
          <div className="flex items-start gap-2 ml-15 pl-0.5">
            <span
              className="inline-block w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: "var(--sage)" }}
            />
            <span className="text-xs italic text-muted flex-1">
              {coaching.content}
            </span>
            {coaching.responseScore != null && (
              <span className="text-xs text-muted shrink-0">
                {coaching.responseScore}/5
              </span>
            )}
          </div>
        )}
      </div>

      {/* Note modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowModal(false)}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-[400px] mx-4 rounded-xl p-6 space-y-4"
            style={{ backgroundColor: "var(--background)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="font-serif text-lg"
              style={{ color: "var(--foreground)" }}
            >
              {title}
            </h3>
            <p className="text-xs text-muted">{time}</p>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="How does this feel? What's on your mind about it?"
              className="w-full h-24 resize-none rounded-lg p-3 text-sm font-serif leading-relaxed focus:outline-none"
              style={{
                backgroundColor: "var(--warm-gray-light)",
                color: "var(--foreground)",
                border: "1px solid var(--warm-gray)",
              }}
              autoFocus
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-1.5 rounded-lg text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-1.5 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: "var(--sage)",
                  color: "var(--background)",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
