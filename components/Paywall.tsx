"use client";

import { useState } from "react";

// 7-day free trial on the annual plan — must match trialDays in app/api/billing/checkout.
const TRIAL_DAYS = 7;

// Display copy only — the actual charge is whatever price ID app/api/billing/checkout
// resolves from env. Keep these in sync by hand when prices change in the Stripe dashboard.
// `wasPerMonth` is the monthly plan's rate, struck through on the annual card so the saving
// is concrete (users shouldn't do the math themselves).
const PLANS = {
  annual: {
    id: "annual",
    perMonth: "$3.99",
    wasPerMonth: "$8.99",
    billed: "billed yearly · $47.88",
    savings: "Save 55%",
  },
  monthly: { id: "monthly", perMonth: "$8.99", billed: "billed monthly" },
  lifetime: { id: "lifetime", price: "$119", billed: "one-time · yours forever" },
} as const;

const BENEFITS = [
  "Unlimited AI-parsed entries — tasks, reminders & goals auto-extracted",
  "Synced & backed up across all your devices",
  "Private & secure — your entries stay yours",
];

type PlanId = "annual" | "monthly" | "lifetime";

interface PaywallProps {
  trigger: "earned" | "quota";
  parsedPreview?: { taskCount: number; reminderCount: number };
  lifetimeAvailable?: boolean; // from GET /api/me/entitlements — STRIPE_PRICE_LIFETIME set?
  onDismiss: () => void;
}

export default function Paywall({ trigger, parsedPreview, lifetimeAvailable = false, onDismiss }: PaywallProps) {
  const [screen, setScreen] = useState<"celebration" | "offer">(
    trigger === "earned" ? "celebration" : "offer"
  );
  // Annual is default-selected — the monthly card acts as a high-priced anchor beside it.
  const [selected, setSelected] = useState<PlanId>("annual");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const hasTrial = selected === "annual";

  const ctaLabel = loading
    ? "Redirecting…"
    : hasTrial
      ? `Start ${TRIAL_DAYS}-day free trial`
      : selected === "lifetime"
        ? "Get lifetime access"
        : "Subscribe";

  const trustLine = hasTrial ? "No payment due today · Cancel anytime" : "Cancel anytime";

  const startCheckout = async () => {
    setLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selected }),
      });
      if (!res.ok) throw new Error("checkout_failed");
      const { url } = await res.json();
      if (url) window.location.href = url;
      else throw new Error("no_url");
    } catch {
      setCheckoutError("Couldn't start checkout. Try again in a moment.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center animate-fade-in px-1">
      {screen === "celebration" && (
        <div className="text-center space-y-6 max-w-xs">
          <p className="font-display text-5xl text-gold/70">✦</p>
          <h2 className="font-display italic text-2xl text-parchment-200 leading-snug">
            You just turned a 40-second brain-dump into{" "}
            {parsedPreview
              ? `${parsedPreview.taskCount} task${parsedPreview.taskCount === 1 ? "" : "s"} and ${parsedPreview.reminderCount} reminder${parsedPreview.reminderCount === 1 ? "" : "s"}.`
              : "structured tasks and reminders."}
          </h2>
          <button onClick={() => setScreen("offer")} className="btn-primary w-full">
            Keep going →
          </button>
          <button
            onClick={onDismiss}
            className="font-mono text-[11px] uppercase tracking-widest text-parchment-700 hover:text-parchment-500 transition-colors"
          >
            not now
          </button>
        </div>
      )}

      {screen === "offer" && (
        <div className="w-full max-w-sm space-y-5">
          {/* Benefit-focused headline (not "you hit your limit") */}
          <div className="text-center space-y-1.5">
            <h2 className="font-display italic text-2xl text-parchment-200">
              Journal without limits
            </h2>
            <p className="font-mono text-xs text-parchment-600">
              Get more out of every entry.
            </p>
          </div>

          {/* Value bullets */}
          <ul className="space-y-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2.5">
                <svg
                  width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="#c8a878" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  className="flex-shrink-0 mt-0.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="font-mono text-[11px] text-parchment-400 leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>

          {/* Plan cards — annual preselected + emphasized, monthly as anchor */}
          <div className="flex flex-col gap-3">
            <AnnualCard selected={selected === "annual"} onSelect={() => setSelected("annual")} />
            <MonthlyCard selected={selected === "monthly"} onSelect={() => setSelected("monthly")} />
            {showAll && lifetimeAvailable && (
              <LifetimeCard
                selected={selected === "lifetime"}
                onSelect={() => setSelected("lifetime")}
              />
            )}
          </div>

          {!showAll && lifetimeAvailable && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-center font-mono text-[10px] uppercase tracking-widest text-parchment-700 hover:text-parchment-500 transition-colors"
            >
              View all plans
            </button>
          )}

          {checkoutError && (
            <p className="font-mono text-xs text-priority-high text-center">{checkoutError}</p>
          )}

          <div className="flex flex-col items-center gap-2">
            <button onClick={startCheckout} disabled={loading} className="btn-primary w-full gap-2">
              {ctaLabel}
              {!loading && <span aria-hidden>›</span>}
            </button>
            <p className="font-mono text-[10px] text-parchment-700">{trustLine}</p>
          </div>

          <button
            onClick={onDismiss}
            className="w-full text-center font-mono text-[11px] uppercase tracking-widest text-parchment-700 hover:text-parchment-500 transition-colors"
          >
            {trigger === "earned" ? "Maybe later" : "Keep journaling for free"}
          </button>
        </div>
      )}
    </div>
  );
}

function AnnualCard({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const p = PLANS.annual;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative text-left w-full px-4 py-4 rounded-xl border-2 transition-all focus:outline-none ${
        selected ? "bg-gold/10 border-gold shadow-gold-glow" : "bg-ink-900 border-ink-700 hover:border-ink-600"
      }`}
    >
      <span className="absolute -top-2.5 right-3 font-mono text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-gold text-onaccent">
        {p.savings}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl text-parchment-100">{p.perMonth}</span>
        <span className="font-mono text-[10px] text-parchment-700">/mo</span>
        <span className="font-mono text-[11px] text-parchment-700 line-through">{p.wasPerMonth}</span>
      </div>
      <p className="font-mono text-[10px] text-parchment-600 mt-1">{p.billed}</p>
      <p className="font-mono text-[10px] text-gold/90 mt-1.5">{TRIAL_DAYS}-day free trial included</p>
    </button>
  );
}

function MonthlyCard({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const p = PLANS.monthly;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left w-full px-4 py-3.5 rounded-xl border transition-all focus:outline-none ${
        selected ? "bg-gold/10 border-gold/50" : "bg-ink-900 border-ink-700 hover:border-ink-600"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-display text-xl text-parchment-200">{p.perMonth}</span>
        <span className="font-mono text-[10px] text-parchment-700">/mo</span>
      </div>
      <p className="font-mono text-[10px] text-parchment-600 mt-1">{p.billed}</p>
    </button>
  );
}

function LifetimeCard({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left w-full px-4 py-3.5 rounded-xl border transition-all focus:outline-none ${
        selected ? "bg-gold/10 border-gold/50" : "bg-ink-900 border-ink-700 hover:border-ink-600"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-display text-xl text-parchment-200">{PLANS.lifetime.price}</span>
      </div>
      <p className="font-mono text-[10px] text-parchment-600 mt-1">{PLANS.lifetime.billed}</p>
    </button>
  );
}
