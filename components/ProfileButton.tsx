"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePreferences } from "@/components/PreferencesProvider";
import { DEMO_PROFILE } from "@/lib/demoData";

// Routes with no app chrome, plus /settings itself (this button *is* the way there).
const HIDDEN_PREFIXES = ["/login", "/landing", "/onboarding", "/settings"];

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "·";
}

// A always-reachable profile shortcut, pinned top-right on mobile. Mirrors BottomNav's shell
// pattern: a full-width, click-through fixed bar whose inner row is centered to the 430px column
// so the avatar aligns with page content; only the avatar itself captures taps.
export default function ProfileButton() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { prefs } = usePreferences();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const name = prefs.displayName ?? session?.user?.name ?? DEMO_PROFILE.name;

  return (
    <div className="md:hidden fixed inset-x-0 top-0 z-50 pt-safe pointer-events-none">
      <div className="mx-auto w-full max-w-[430px] flex justify-end px-4 pt-3">
        <Link
          href="/settings"
          aria-label="Profile and settings"
          className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full
                     bg-ink-900/60 backdrop-blur-xl border border-parchment-100/10
                     shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]
                     text-parchment-200 font-display italic text-base leading-none
                     transition-transform active:scale-95"
        >
          {initialOf(name)}
        </Link>
      </div>
    </div>
  );
}
