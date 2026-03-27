"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface PacedTextRendererProps {
  /** The full text to reveal */
  text: string;
  /** Words per second (default ~3) */
  wordsPerSecond?: number;
  /** Extra pause at paragraph breaks in ms */
  paragraphPause?: number;
  /** Whether text is still streaming in */
  isStreaming?: boolean;
  /** Called when all text has been revealed */
  onComplete?: () => void;
  /** Instantly reveal all text */
  revealAll?: boolean;
}

export default function PacedTextRenderer({
  text,
  wordsPerSecond = 3,
  paragraphPause = 600,
  isStreaming = false,
  onComplete,
  revealAll = false,
}: PacedTextRendererProps) {
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);
  const wordsRef = useRef<string[]>([]);
  const totalWordsRef = useRef(0);

  // Recompute words when text changes
  wordsRef.current = text.split(/(\s+)/);
  totalWordsRef.current = wordsRef.current.filter((w) => w.trim()).length;

  const totalWords = totalWordsRef.current;

  const advance = useCallback(() => {
    setVisibleWordCount((prev) => {
      const next = prev + 1;
      if (next >= totalWordsRef.current) {
        return totalWordsRef.current;
      }

      // Check if the next word follows a paragraph break
      const visibleText = getVisibleText(wordsRef.current, next);
      const isParagraphBreak = visibleText.endsWith("\n\n");
      const delay = isParagraphBreak ? paragraphPause : 1000 / wordsPerSecond;

      timerRef.current = setTimeout(advance, delay);
      return next;
    });
  }, [paragraphPause, wordsPerSecond]);

  useEffect(() => {
    if (revealAll) {
      setVisibleWordCount(totalWords);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    const initialDelay = 1000 / wordsPerSecond;
    timerRef.current = setTimeout(advance, initialDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [totalWords, wordsPerSecond, revealAll, advance]);

  // Fire onComplete in a separate effect to avoid setState-during-render
  useEffect(() => {
    if (
      !isStreaming &&
      visibleWordCount >= totalWords &&
      totalWords > 0 &&
      !completedRef.current
    ) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [isStreaming, visibleWordCount, totalWords, onComplete]);

  const visibleText = revealAll
    ? text
    : getVisibleText(wordsRef.current, visibleWordCount);

  return (
    <span
      className="cursor-pointer"
      onClick={() => setVisibleWordCount(totalWords)}
      title="Click to reveal all"
    >
      {visibleText}
      {!revealAll && visibleWordCount < totalWords && (
        <span className="inline-block w-1 h-4 bg-sage/40 ml-0.5 animate-pulse" />
      )}
    </span>
  );
}

function getVisibleText(words: string[], wordCount: number): string {
  let count = 0;
  let result = "";
  for (const word of words) {
    if (word.trim()) {
      count++;
      if (count > wordCount) break;
    }
    result += word;
  }
  return result;
}
