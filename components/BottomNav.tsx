"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Symbolic glyphs — no external icon library needed
const tabs = [
  { href: "/",         glyph: "✦", label: "Journal"  },
  { href: "/schedule", glyph: "▦", label: "Schedule" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    // Fixed to the bottom; safe-area padding handles iPhone home bar
    <nav className="sticky bottom-0 z-50 bg-ink-950/95 backdrop-blur-sm border-t border-ink-700 pb-safe">
      <div className="flex">
        {tabs.map(({ href, glyph, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex-1 flex flex-col items-center justify-center
                min-h-[56px] gap-1 transition-colors duration-200
                ${active ? "text-parchment-200" : "text-parchment-700 hover:text-parchment-600"}
              `}
            >
              {/* Glyph — larger when active */}
              <span
                className={`
                  font-mono leading-none transition-all duration-200
                  ${active ? "text-xl text-gold" : "text-base"}
                `}
              >
                {glyph}
              </span>
              {/* Label */}
              <span className={`text-[9px] font-mono uppercase tracking-widest ${active ? "text-parchment-400" : "text-parchment-700"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
