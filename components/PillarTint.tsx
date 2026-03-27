"use client";

import { useState, useEffect } from "react";

interface PillarTintProps {
  tint: "blue" | "rose" | "violet" | "amber" | "neutral";
}

const hues: Record<PillarTintProps["tint"], string> = {
  blue: "147, 197, 222",
  rose: "210, 150, 150",
  violet: "170, 150, 200",
  amber: "200, 170, 110",
  neutral: "",
};

function getColor(tint: PillarTintProps["tint"], isDark: boolean): string {
  if (tint === "neutral") return "transparent";
  const opacity = isDark ? 0.05 : 0.07;
  return `rgba(${hues[tint]}, ${opacity})`;
}

export default function PillarTint({ tint }: PillarTintProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => {
      const html = document.documentElement;
      const hasDarkClass = html.classList.contains("dark");
      const hasLightClass = html.classList.contains("light");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

      setIsDark(hasDarkClass || (prefersDark && !hasLightClass));
    };

    check();

    // Watch for class changes on <html>
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Watch for system preference changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", check);

    return () => {
      observer.disconnect();
      mq.removeEventListener("change", check);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[1]"
      data-tour-id="pillar-tint"
      style={{
        backgroundColor: getColor(tint, isDark),
        transition: "background-color 4s ease",
      }}
    />
  );
}
