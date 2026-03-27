"use client";

interface MessageBubbleProps {
  role: "user" | "assistant";
  children: React.ReactNode;
}

export default function MessageBubble({ role, children }: MessageBubbleProps) {
  return (
    <div
      className={`animate-fade-in max-w-[90%] ${
        role === "user" ? "self-end" : "self-start"
      }`}
    >
      <div
        className={`rounded-2xl px-5 py-3 text-base leading-relaxed ${
          role === "user"
            ? "bg-sage-light text-foreground rounded-br-md"
            : "bg-warm-gray-light text-foreground rounded-bl-md"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
