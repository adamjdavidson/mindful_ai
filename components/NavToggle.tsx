"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const modes = [
  { label: "Chat", href: "/" },
  { label: "Companion", href: "/companion" },
] as const;

export default function NavToggle() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-center gap-6 border-b border-warm-gray-light py-2">
      {modes.map((mode) => {
        const isActive =
          mode.href === "/"
            ? pathname === "/"
            : pathname.startsWith(mode.href);

        return (
          <Link
            key={mode.href}
            href={mode.href}
            className={
              isActive
                ? "border-b-2 border-sage text-sage text-sm pb-1 transition-colors"
                : "text-muted hover:text-foreground text-sm pb-1 transition-colors"
            }
          >
            {mode.label}
          </Link>
        );
      })}
    </nav>
  );
}
