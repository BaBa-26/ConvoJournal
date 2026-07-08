"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePreferences } from "@/components/PreferencesProvider";
import { useSettingsUI } from "@/components/settings/SettingsUIProvider";
import SettingsMenuPanel from "@/components/settings/SettingsMenuPanel";
import type { SettingsCategory } from "@/components/settings/categories";
import { DEMO_PROFILE } from "@/lib/demoData";

// Routes with no app chrome. The avatar drops a quick menu; picking an item opens the settings dialog.
const HIDDEN_PREFIXES = ["/login", "/landing", "/onboarding"];

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "·";
}

// Mobile-only. Tapping the pinned top-right avatar opens a smooth dropdown of settings sections;
// choosing one opens the full settings dialog at that section.
export default function ProfileButton() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { prefs } = usePreferences();
  const { openSettings } = useSettingsUI();
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  // Close on outside tap or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Hide the trigger when the routes carry their own chrome. (Hooks above always run.)
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const name = prefs.displayName ?? session?.user?.name ?? DEMO_PROFILE.name;

  const pick = (cat: SettingsCategory) => {
    setMenuOpen(false);
    openSettings(cat);
  };

  return (
    <div className="md:hidden fixed inset-x-0 top-0 z-50 pt-safe pointer-events-none">
      <div className="mx-auto w-full max-w-[430px] flex justify-end px-4 pt-3">
        <div ref={anchorRef} className="relative pointer-events-auto">
          {/* Avatar trigger */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Settings menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center justify-center w-10 h-10 rounded-full
                       bg-ink-900/60 backdrop-blur-xl border border-parchment-100/10
                       shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]
                       text-parchment-200 font-display italic text-base leading-none
                       transition-transform active:scale-95"
          >
            {initialOf(name)}
          </button>

          {/* Dropdown menu — drops down from the avatar */}
          <SettingsMenuPanel open={menuOpen} placement="down" onPick={pick} className="right-0" />
        </div>
      </div>
    </div>
  );
}
