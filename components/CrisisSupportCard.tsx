"use client";

import { useMemo, useState } from "react";
import { resolveResources, type RiskFlag, type RiskSignal } from "@/lib/crisis";

// ─────────────────────────────────────────────────────────────────────────────
// Soft-landing support card, shown above the review screen when the analysis
// carries a crisis signal. Design rules (see lib/crisis.ts):
//   - ALL copy here is static, keyed off the RiskFlag/RiskLevel enums — no
//     model-generated text can ever reach this card (injection-proof).
//   - Never blocks journaling: it sits above the normal review UI; save and
//     discard behave exactly as always.
//   - Dismissible, but collapses to a small persistent link rather than
//     vanishing — help stays one tap away for the rest of the review.
//   - The signal is transient: nothing about it is saved with the entry.
// ─────────────────────────────────────────────────────────────────────────────

// Headline per category, most specific flag wins. Calm, non-clinical, no alarm.
const HEADLINES: Record<RiskFlag, string> = {
  self_harm: "It sounds like you're carrying something really heavy right now.",
  abuse:     "What you described sounds unsafe — you deserve to be safe and supported.",
  violence:  "It sounds like things feel close to boiling over right now.",
  distress:  "It sounds like today has been really hard.",
};
const GENERIC_HEADLINE = "It sounds like you're going through a lot right now.";

// Priority order for picking the headline when several flags are present.
const FLAG_PRIORITY: RiskFlag[] = ["self_harm", "abuse", "violence", "distress"];

function headlineFor(flags: RiskFlag[]): string {
  for (const f of FLAG_PRIORITY) if (flags.includes(f)) return HEADLINES[f];
  return GENERIC_HEADLINE;
}

const KIND_ICON: Record<string, string> = { call: "☎", text: "✉", link: "➜" };

export default function CrisisSupportCard({ risk }: { risk: RiskSignal }) {
  const [dismissed, setDismissed] = useState(false);

  // Region hint from the browser — device-local, never sent anywhere.
  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return undefined;
    }
  }, []);

  const resources = useMemo(
    () => resolveResources(risk.flags, timezone),
    [risk.flags, timezone]
  );

  if (risk.level === "none") return null;

  // Dismissed → collapse to a quiet persistent link, not nothing.
  if (dismissed) {
    return (
      <a
        href="https://findahelpline.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-left text-[10px] font-mono uppercase tracking-widest text-parchment-700
                   hover:text-parchment-500 transition-colors"
      >
        support resources ➜
      </a>
    );
  }

  // Gentle single-line variant for "concern" — a nudge, not a takeover.
  if (risk.level === "concern") {
    return (
      <div className="card-tight border border-gold/25 bg-gold/5 flex items-start justify-between gap-3">
        <p className="text-sm font-mono text-parchment-300 leading-relaxed">
          {headlineFor(risk.flags)}{" "}
          <a
            href="https://findahelpline.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:underline whitespace-nowrap"
          >
            Support is here if you want it ➜
          </a>
        </p>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss support note"
          className="text-parchment-700 hover:text-parchment-400 transition-colors text-sm leading-none mt-0.5"
        >
          ✕
        </button>
      </div>
    );
  }

  // Full card for "crisis".
  return (
    <div className="card border border-gold/30 bg-gold/5 space-y-4" role="note" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="label">you're not alone</p>
          <p className="text-sm text-parchment-200 leading-relaxed">{headlineFor(risk.flags)}</p>
          <p className="text-[12px] font-mono text-parchment-500 leading-relaxed">
            You don't have to face this by yourself — free, confidential support is available right now.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss support card"
          className="text-parchment-700 hover:text-parchment-400 transition-colors text-sm leading-none"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        {resources.map((r) => (
          <a
            key={r.href}
            href={r.href}
            target={r.kind === "link" ? "_blank" : undefined}
            rel={r.kind === "link" ? "noopener noreferrer" : undefined}
            className="flex items-start gap-2.5 rounded-lg border border-gold/20 bg-ink-900/40
                       px-3 py-2.5 hover:border-gold/40 transition-colors"
          >
            <span className="text-gold text-sm leading-none mt-0.5" aria-hidden>
              {KIND_ICON[r.kind] ?? "➜"}
            </span>
            <span>
              <span className="block text-sm font-mono text-parchment-200">{r.label}</span>
              {r.detail && (
                <span className="block text-[10px] font-mono text-parchment-600 mt-0.5">{r.detail}</span>
              )}
            </span>
          </a>
        ))}
      </div>

      <p className="text-[10px] font-mono text-parchment-700 leading-relaxed">
        If you're in immediate danger, call your local emergency number. Your journal stays yours —
        this note isn't saved with your entry.
      </p>
    </div>
  );
}
