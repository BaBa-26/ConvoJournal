"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";

// Icon shapes from the design: circle=Today, r-square=Journal, square=Calendar, diamond=Goals
const tabs = [
  { href: "/",         shape: "circle",   label: "Today"    },
  { href: "/journal",  shape: "r-square", label: "Journal"  },
  { href: "/schedule", shape: "square",   label: "Calendar" },
  { href: "/tasks",    shape: "diamond",  label: "To-Do's"  },
];

// Routes that shouldn't show the app nav.
const HIDDEN_PREFIXES = ["/login", "/landing", "/onboarding"];

function TabIcon({ shape, active }: { shape: string; active: boolean }) {
  const common: React.CSSProperties = {
    display: "inline-block",
    flexShrink: 0,
    transition: "all 0.2s ease",
    background: active ? "rgb(var(--accent))" : "transparent",
    border: active ? "none" : "1.6px solid rgb(var(--parchment-700))",
  };

  if (shape === "circle")   return <span style={{ ...common, width: 16, height: 16, borderRadius: "50%" }} />;
  if (shape === "r-square") return <span style={{ ...common, width: 16, height: 16, borderRadius: 4 }} />;
  if (shape === "square")   return <span style={{ ...common, width: 16, height: 16, borderRadius: 2 }} />;
  // diamond — rotated square
  return <span style={{ ...common, width: 12, height: 12, borderRadius: 2, transform: "rotate(45deg)" }} />;
}

export default function BottomNav() {
  const pathname = usePathname();
  useSwipeNavigation();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    // Full-width fixed shell is click-through; only the centered pill captures taps.
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 pb-safe pointer-events-none">
      <div
        className="pointer-events-auto mx-auto mb-3 w-fit max-w-[calc(100%-1.5rem)]
                   flex items-center gap-1 rounded-full p-1.5
                   bg-ink-900/60 backdrop-blur-xl border border-parchment-100/10
                   shadow-[0_10px_40px_-8px_rgba(0,0,0,0.6)]"
      >
        {tabs.map(({ href, shape, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="relative flex flex-col items-center justify-center gap-1
                         rounded-full px-4 py-2 min-h-[52px] min-w-[62px]"
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-parchment-100/10 border border-parchment-100/10"
                />
              )}
              <span className="relative z-10">
                <TabIcon shape={shape} active={active} />
              </span>
              <span
                className={`relative z-10 text-[9px] font-mono uppercase tracking-widest transition-colors ${
                  active ? "text-parchment-100" : "text-parchment-600"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
