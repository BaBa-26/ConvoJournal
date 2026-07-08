"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePreferences } from "@/components/PreferencesProvider";
import { useSettingsUI } from "@/components/settings/SettingsUIProvider";
import SettingsMenuPanel from "@/components/settings/SettingsMenuPanel";
import type { SettingsCategory } from "@/components/settings/categories";
import { DEMO_PROFILE } from "@/lib/demoData";
import BrandMark from "@/components/BrandMark";

// Routes with their own full-bleed chrome — the app sidebar stands down there.
const HIDDEN_PREFIXES = ["/login", "/landing", "/onboarding"];

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "·";
}

const tabs = [
  { href: "/",         shape: "circle",   label: "Today"    },
  { href: "/journal",  shape: "r-square", label: "Journal"  },
  { href: "/schedule", shape: "square",   label: "Calendar" },
  { href: "/tasks",    shape: "diamond",  label: "To-Do's"  },
];

function NavIcon({ shape, active }: { shape: string; active: boolean }) {
  const style: React.CSSProperties = {
    display: "inline-block",
    flexShrink: 0,
    transition: "all 0.2s ease",
    background: active ? "rgb(var(--accent))" : "transparent",
    border: active ? "none" : "1.6px solid #4a3c2e",
  };
  if (shape === "circle")   return <span style={{ ...style, width: 14, height: 14, borderRadius: "50%" }} />;
  if (shape === "r-square") return <span style={{ ...style, width: 14, height: 14, borderRadius: 4 }} />;
  if (shape === "square")   return <span style={{ ...style, width: 14, height: 14, borderRadius: 2 }} />;
  return <span style={{ ...style, width: 10, height: 10, borderRadius: 2, transform: "rotate(45deg)" }} />;
}

export default function SideNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { prefs } = usePreferences();
  const { openSettings } = useSettingsUI();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the quick-menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
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

  const pickCategory = (cat: SettingsCategory) => {
    setMenuOpen(false);
    openSettings(cat);
  };

  const name = prefs.displayName ?? session?.user?.name ?? DEMO_PROFILE.name;
  const image = session?.user?.image ?? null;
  const subLabel = session?.user?.email ?? "Sign in to save";

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav className="hidden md:flex flex-col w-48 shrink-0 h-screen sticky top-0 border-r border-ink-700 bg-ink-950">
      {/* Wordmark — links to landing page */}
      <div className="px-5 pt-8 pb-5">
        <Link
          href="/landing"
          className="flex items-center gap-2.5 text-parchment-200 hover:text-gold transition-colors duration-150"
        >
          <BrandMark size={22} stroke={8} dotR={3.4} />
          <span className="font-display italic text-xl tracking-tight">Progress</span>
        </Link>
      </div>

      <div className="mx-4 border-t border-ink-700 mb-3" />

      {/* Nav items */}
      <div className="flex flex-col gap-0.5 px-2 flex-1">
        {tabs.map(({ href, shape, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                transition-all duration-150
                ${active
                  ? "bg-ink-800 text-parchment-200"
                  : "text-parchment-700 hover:text-parchment-400 hover:bg-ink-900"
                }
              `}
            >
              <NavIcon shape={shape} active={active} />
              <span className={`font-mono text-[11px] uppercase tracking-[0.15em] ${
                active ? "text-parchment-300" : "text-parchment-700"
              }`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mx-4 border-t border-ink-700 mt-3 mb-3" />
      <div className="px-3 pb-5 space-y-2">
        {/* Account — avatar + name, opens the settings dialog on the Account tab */}
        <button
          onClick={() => openSettings("account")}
          aria-label="Your profile and account"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-ink-800 w-full text-left
                     hover:border-ink-700 hover:bg-ink-900 transition-colors group"
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <span className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 text-accent
                             flex items-center justify-center font-display italic text-sm flex-shrink-0">
              {initialOf(name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] text-parchment-300 truncate group-hover:text-parchment-200 transition-colors">
              {name}
            </p>
            <p className="font-mono text-[9px] text-parchment-700 truncate">{subLabel}</p>
          </div>
          <span className="text-parchment-800 group-hover:text-parchment-500 transition-colors">→</span>
        </button>

        {/* Settings — opens a quick-menu that rises above the footer; pick a section to open it */}
        <div ref={menuRef} className="relative">
          <SettingsMenuPanel open={menuOpen} placement="up" onPick={pickCategory} className="left-0" />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-xl transition-colors ${
              menuOpen ? "text-parchment-300 bg-ink-900" : "text-parchment-700 hover:text-parchment-300"
            }`}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Settings</span>
            <span className="text-parchment-800">⚙</span>
          </button>
        </div>
        <p className="px-2 font-mono text-[9px] text-parchment-800 uppercase tracking-widest">
          v1.0
        </p>
      </div>
    </nav>
  );
}
