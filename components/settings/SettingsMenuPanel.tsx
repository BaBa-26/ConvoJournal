"use client";

import { CATEGORIES, ICONS, type SettingsCategory } from "./categories";

// The shared settings quick-menu: a "Settings" header + category items. Positioning and open/close
// animation are set by the caller; `placement` only picks the slide direction and transform origin.
export default function SettingsMenuPanel({
  open,
  placement,
  onPick,
  className = "",
}: {
  open: boolean;
  placement: "up" | "down";
  onPick: (c: SettingsCategory) => void;
  /** Horizontal anchoring, e.g. "right-0" or "left-2 right-2". */
  className?: string;
}) {
  const anim =
    placement === "up"
      ? `bottom-full mb-2 origin-bottom ${
          open ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" : "opacity-0 translate-y-2 scale-95 pointer-events-none"
        }`
      : `top-full mt-2 origin-top ${
          open ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
        }`;

  return (
    <div
      role="menu"
      aria-hidden={!open}
      className={`absolute z-10 w-60 rounded-2xl overflow-hidden
                  bg-ink-900/95 backdrop-blur-xl border border-ink-700
                  shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]
                  transition-all duration-200 ease-out ${anim} ${className}`}
    >
      <p className="px-4 pt-3 pb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-parchment-700">
        Settings
      </p>
      <div className="pb-1.5">
        {CATEGORIES.map(({ key, label, soon }) => {
          const Icon = ICONS[key];
          return (
            <button
              key={key}
              role="menuitem"
              disabled={soon}
              tabIndex={open && !soon ? 0 : -1}
              onClick={() => !soon && onPick(key)}
              className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors
                          ${soon ? "opacity-40 cursor-default" : "hover:bg-ink-800 active:bg-ink-800"}`}
            >
              <Icon className="text-parchment-500" />
              <span className="flex-1 font-mono text-[11px] uppercase tracking-[0.12em] text-parchment-300">
                {label}
              </span>
              {soon && (
                <span className="font-mono text-[8px] uppercase tracking-widest text-parchment-700 border border-ink-600 rounded-full px-1.5 py-0.5">
                  soon
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
