"use client";

import { useEffect, useRef } from "react";

// The product's signature control (design-system §6.6).
// idle       — breathing accent halo, mic glyph
// recording  — halo tracks the live input level; glyph becomes a stop square
// processing — disabled, thin accent arc spins
// denied     — slashed mic; the surrounding screen renders the recovery state (§7.2)

export type RecordButtonState = "idle" | "recording" | "processing" | "denied";

const SIZES = {
  hero: { disc: "w-24 h-24", glyph: 36 },
  compact: { disc: "w-14 h-14", glyph: 22 },
};

export default function RecordButton({
  state,
  onPress,
  size = "hero",
  levelRef,
  className = "",
}: {
  state: RecordButtonState;
  onPress: () => void;
  size?: keyof typeof SIZES;
  /** Live 0…1 input level (from useRecorder) — drives the listening halo. */
  levelRef?: React.MutableRefObject<number>;
  className?: string;
}) {
  const haloRef = useRef<HTMLSpanElement>(null);
  const s = SIZES[size];

  // While recording, the halo swells with the real voice level (rAF, no re-renders).
  useEffect(() => {
    if (state !== "recording" || !levelRef) return;
    let raf: number;
    const tick = () => {
      const el = haloRef.current;
      if (el) {
        const l = levelRef.current;
        el.style.transform = `scale(${1 + l * 0.18})`;
        el.style.opacity = String(0.15 + l * 0.35);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, levelRef]);

  const label =
    state === "recording"
      ? "Stop recording"
      : state === "processing"
        ? "Processing entry"
        : state === "denied"
          ? "Microphone unavailable — tap to retry"
          : "Start recording";

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Halo — breathes when idle, tracks voice while recording */}
      {state === "idle" && (
        <span aria-hidden className="absolute inset-0 rounded-full bg-accent/20 animate-breathe" />
      )}
      {state === "recording" && (
        <span
          ref={haloRef}
          aria-hidden
          className="absolute inset-0 rounded-full bg-accent/25 transition-none"
          style={{ opacity: 0.15 }}
        />
      )}
      {/* Processing arc */}
      {state === "processing" && (
        <span
          aria-hidden
          className="absolute -inset-1.5 rounded-full border-2 border-transparent
                     border-t-accent/70 animate-spin-slow"
        />
      )}

      <button
        onClick={onPress}
        disabled={state === "processing"}
        aria-label={label}
        className={`relative ${s.disc} rounded-full flex items-center justify-center
                    transition-all duration-quick active:scale-[0.97]
                    disabled:cursor-default
                    ${
                      state === "recording"
                        ? "bg-accent/15 border-2 border-accent"
                        : state === "denied"
                          ? "bg-ink-800 border-2 border-ink-600"
                          : "bg-ink-800 border-2 border-accent/50 hover:border-accent hover:shadow-glow"
                    }`}
      >
        {state === "recording" ? (
          // Stop square
          <span
            aria-hidden
            className="rounded-sm bg-parchment-100"
            style={{ width: s.glyph * 0.55, height: s.glyph * 0.55 }}
          />
        ) : state === "denied" ? (
          // Slashed mic
          <svg
            aria-hidden
            width={s.glyph}
            height={s.glyph}
            viewBox="0 0 24 24"
            fill="none"
            className="text-parchment-600"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
            <line x1="3" y1="3" x2="21" y2="21" />
          </svg>
        ) : (
          // Mic — accent-aware (follows the user's accent preset)
          <svg
            aria-hidden
            width={s.glyph}
            height={s.glyph}
            viewBox="0 0 24 24"
            fill="none"
            className={state === "processing" ? "text-accent/40" : "text-accent"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>
    </div>
  );
}
