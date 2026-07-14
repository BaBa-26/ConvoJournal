"use client";

import { useRef, useState, useEffect } from "react";

// Time-tinted section card (design-system §6.4) — the Yesterday / Today / Tomorrow
// panels of a parsed entry. Warm-family tints only (§1.4); body text stays parchment.
// `editable` turns the body into a seamless textarea so the review screen lets the
// user correct the parse in place. `index` staggers the entrance (§7.4 payoff).

export type SectionTint = "past" | "now" | "next";

const TINTS: Record<SectionTint, { bg: string; border: string; label: string; focus: string }> = {
  past: {
    bg: "bg-tint-past/[0.12]",
    border: "border-tint-past/30",
    label: "text-tint-past-label",
    focus: "focus-within:border-tint-past/50",
  },
  now: {
    bg: "bg-tint-now/[0.12]",
    border: "border-tint-now/30",
    label: "text-tint-now-label",
    focus: "focus-within:border-tint-now/50",
  },
  next: {
    bg: "bg-tint-next/[0.12]",
    border: "border-tint-next/30",
    label: "text-tint-next-label",
    focus: "focus-within:border-tint-next/50",
  },
};

export default function SectionCard({
  tint,
  label,
  content,
  editable = false,
  onChange,
  index,
}: {
  tint: SectionTint;
  label: string;
  content: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  /** Stagger position for the payoff entrance; omit to render without animation. */
  index?: number;
}) {
  const t = TINTS[tint];
  const [dirty, setDirty] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Seamless textarea: grow to fit content, never scroll inside the card.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [content, editable]);

  return (
    <div
      className={`rounded-xl border p-4 ${t.bg} ${t.border} ${editable ? t.focus : ""} ${
        index !== undefined ? "animate-rise" : ""
      } transition-colors duration-quick`}
      style={index !== undefined ? { animationDelay: `${index * 80}ms` } : undefined}
    >
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className={`text-label font-mono uppercase ${t.label}`}>{label}</p>
        {dirty && (
          <span className="text-label font-mono uppercase text-parchment-700">edited</span>
        )}
      </div>
      {editable ? (
        <textarea
          ref={taRef}
          value={content}
          onChange={(e) => {
            setDirty(true);
            onChange?.(e.target.value);
          }}
          rows={1}
          className="w-full bg-transparent font-mono text-body-lg text-parchment-300
                     resize-none overflow-hidden focus:outline-none"
          aria-label={`Edit ${label} section`}
        />
      ) : (
        <p className="font-mono text-body-lg text-parchment-300 whitespace-pre-wrap">{content}</p>
      )}
    </div>
  );
}
