"use client";

import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import PacedTextRenderer from "./PacedTextRenderer";
import BreathingCircle from "./BreathingCircle";
import Markdown from "./Markdown";
import { Message } from "@/lib/session";

interface ChatInterfaceProps {
  intention: string;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onMeditationBreak: () => void;
  onEndSession: () => void;
  onNewSession?: () => void;
  streamingText: string;
  isStreaming: boolean;
  isWaiting: boolean;
  exchangeCount: number;
  onError?: () => void;
  error?: string | null;
  pacingMultiplier?: number;
}

export default function ChatInterface({
  intention,
  messages,
  onSendMessage,
  onMeditationBreak,
  onEndSession,
  onNewSession,
  streamingText,
  isStreaming,
  isWaiting,
  exchangeCount,
  onError,
  error,
  pacingMultiplier,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [revealedMessages, setRevealedMessages] = useState<Set<number>>(
    () => new Set(messages.map((_, i) => i))
  );

  // When new messages arrive (e.g. from streaming), mark them as revealed immediately
  // so they render through Markdown, not PacedTextRenderer again
  useEffect(() => {
    setRevealedMessages((prev) => {
      if (messages.length <= prev.size) return prev;
      const next = new Set(prev);
      for (let i = 0; i < messages.length; i++) {
        next.add(i);
      }
      return next;
    });
  }, [messages.length]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Re-focus the input after streaming/waiting ends
  useEffect(() => {
    if (!isStreaming && !isWaiting) {
      inputRef.current?.focus();
    }
  }, [isStreaming, isWaiting]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, streamingText]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || isWaiting) return;
    setInput("");
    onSendMessage(trimmed);
  };

  const adjustedWordsPerSecond = 3 * (pacingMultiplier || 1);

  return (
    <div className="flex flex-1 flex-col max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-warm-gray-light">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-sage" />
          <p className="text-sm text-muted italic truncate max-w-xs">
            {intention}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {onNewSession && (
            <button
              onClick={onNewSession}
              className="text-sm text-sage hover:text-sage/80 transition-colors"
            >
              Start a new session
            </button>
          )}
          <button
            onClick={onEndSession}
            className="text-sm text-muted hover:text-sage transition-colors"
          >
            End session
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        data-tour-id="ai-response"
        className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4"
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role}>
            {msg.role === "assistant" ? (
              revealedMessages.has(i) ? (
                <Markdown>
                  {msg.content.replace(/\[PAUSE_SUGGESTED\]/g, "").trim()}
                </Markdown>
              ) : (
                <PacedTextRenderer
                  text={msg.content.replace(/\[PAUSE_SUGGESTED\]/g, "").trim()}
                  wordsPerSecond={adjustedWordsPerSecond}
                  onComplete={() =>
                    setRevealedMessages((prev) => new Set(prev).add(i))
                  }
                />
              )
            ) : (
              msg.content
            )}
          </MessageBubble>
        ))}

        {/* Streaming response */}
        {(isWaiting || isStreaming) && (
          <MessageBubble role="assistant">
            {isWaiting ? (
              <div className="flex items-center gap-3 py-1">
                <BreathingCircle size={24} showLabel={false} />
                <span className="text-muted text-sm">Taking a breath...</span>
              </div>
            ) : (
              <Markdown>
                {streamingText.replace(/\[PAUSE_SUGGESTED\]/g, "").trim()}
              </Markdown>
            )}
          </MessageBubble>
        )}

        {/* Error message */}
        {error && (
          <MessageBubble role="assistant">
            <div className="flex flex-col gap-3">
              <p className="text-sm">{error}</p>
              <button
                onClick={onError}
                className="self-start px-4 py-1.5 rounded-full text-xs border border-warm-gray text-muted hover:border-sage hover:text-sage transition-colors"
              >
                Try again
              </button>
            </div>
          </MessageBubble>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 pb-10 border-t border-warm-gray-light">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Share your thoughts..."
            rows={1}
            className="flex-1 bg-transparent border-b-2 border-warm-gray focus:border-sage outline-none resize-none text-base py-2 px-1 placeholder:text-muted/40 transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isStreaming || isWaiting}
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming || isWaiting}
            className="px-5 py-2 rounded-full text-sm bg-sage text-white hover:bg-sage/90 transition-colors disabled:opacity-40 disabled:hover:bg-sage"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
