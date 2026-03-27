"use client";

import ReactMarkdown from "react-markdown";

interface MarkdownProps {
  children: string;
}

export default function Markdown({ children }: MarkdownProps) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => (
          <ul className="list-disc pl-5 mb-3 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 mb-3 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="mb-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-sage/40 pl-3 italic text-muted mb-3 last:mb-0">
            {children}
          </blockquote>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
