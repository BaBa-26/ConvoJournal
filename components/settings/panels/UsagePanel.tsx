"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";

interface Ent {
  plan: "free" | "premium" | "anonymous";
  weeklyLimit: number | null;
  used: number;
  remaining: number | null;
  canAnalyze: boolean;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
}

// Plan, weekly AI usage, and subscription management — the "Usage" settings tab.
// Free users see their weekly analyze count + an upgrade offer; premium users see their
// status/renewal and a link to Stripe's customer portal (manage/cancel).
export default function UsagePanel() {
  const { data: session } = useSession();
  const [ent, setEnt] = useState<Ent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/entitlements")
      .then((r) => r.json())
      .then(setEnt)
      .catch(() => setError("Couldn't load your plan."))
      .finally(() => setLoading(false));
  }, []);

  const startCheckout = async (plan: "annual" | "monthly") => {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      if (url) window.location.href = url;
      else throw new Error();
    } catch {
      setError("Couldn't start checkout. Try again in a moment.");
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      if (url) window.location.href = url;
      else throw new Error();
    } catch {
      setError("Couldn't open the billing portal. Try again in a moment.");
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="card text-center py-10">
        <p className="font-mono text-[11px] text-parchment-700">Loading your plan…</p>
      </div>
    );
  }

  // Not signed in — usage is tracked per account, so nudge to sign in.
  if (!session || ent?.plan === "anonymous") {
    return (
      <div className="card text-center py-10 space-y-2">
        <p className="font-display italic text-lg text-parchment-300">Sign in to track usage</p>
        <p className="font-mono text-[11px] text-parchment-700 leading-6">
          Your plan, weekly AI usage, and subscription live here once you&apos;re signed in.
        </p>
      </div>
    );
  }

  const isPremium = ent?.plan === "premium";

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-3 rounded-xl bg-priority-high/10 border border-priority-high/30">
          <p className="font-mono text-xs text-priority-high">{error}</p>
        </div>
      )}

      {isPremium ? (
        <PremiumStatus ent={ent!} busy={busy === "portal"} onManage={openPortal} />
      ) : (
        <FreeStatus ent={ent!} busy={busy} onCheckout={startCheckout} />
      )}
    </div>
  );
}

function PremiumStatus({ ent, busy, onManage }: { ent: Ent; busy: boolean; onManage: () => void }) {
  const status = ent.subscriptionStatus;
  const end = ent.currentPeriodEnd ? new Date(ent.currentPeriodEnd) : null;

  // Lifetime = premium with no subscription; trialing/active carry a period end.
  let line: string;
  if (!status) line = "Lifetime access · never expires";
  else if (status === "trialing") line = end ? `Free trial · ends ${format(end, "MMM d, yyyy")}` : "Free trial";
  else if (status === "active") line = end ? `Renews ${format(end, "MMM d, yyyy")}` : "Active";
  else if (status === "past_due") line = "Payment past due — update your card to keep Premium";
  else if (status === "canceled") line = end ? `Ends ${format(end, "MMM d, yyyy")}` : "Cancelled";
  else line = status;

  return (
    <>
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="label">Your plan</p>
          <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-gold text-onaccent">
            Premium
          </span>
        </div>
        <p className="font-display italic text-xl text-parchment-100">Unlimited AI analysis</p>
        <p className="font-mono text-[11px] text-parchment-600">{line}</p>
      </section>

      <section className="card space-y-3">
        <p className="label">Manage</p>
        <p className="font-mono text-[11px] text-parchment-600 leading-6">
          Update your payment method, switch plans, or cancel anytime through Stripe&apos;s secure portal.
        </p>
        <button onClick={onManage} disabled={busy} className="btn-primary w-full">
          {busy ? "Opening…" : "Manage subscription"}
        </button>
      </section>
    </>
  );
}

function FreeStatus({
  ent,
  busy,
  onCheckout,
}: {
  ent: Ent;
  busy: string | null;
  onCheckout: (plan: "annual" | "monthly") => void;
}) {
  const limit = ent.weeklyLimit ?? 3;
  const used = Math.min(ent.used, limit);
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const atLimit = ent.remaining === 0;

  return (
    <>
      {/* Weekly usage */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="label">Your plan</p>
          <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-ink-600 text-parchment-500">
            Free
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[11px] text-parchment-500">AI entries this week</p>
            <p className="font-mono text-xs text-parchment-300">
              {used} <span className="text-parchment-700">/ {limit}</span>
            </p>
          </div>
          <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${atLimit ? "bg-priority-high" : "bg-gold"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="font-mono text-[10px] text-parchment-700 leading-5">
            {atLimit
              ? "You've used all your free AI entries this week. Journaling stays free — plain entries save as normal, and your allowance refreshes on a rolling 7-day window."
              : `${ent.remaining} left this week · refreshes on a rolling 7-day window.`}
          </p>
        </div>
      </section>

      {/* Upgrade */}
      <section className="card space-y-3">
        <p className="label">Upgrade to Premium</p>
        <ul className="space-y-1.5">
          {["Unlimited AI-parsed entries", "Synced & backed up across devices", "Private & secure"].map((b) => (
            <li key={b} className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8a878" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="font-mono text-[11px] text-parchment-400">{b}</span>
            </li>
          ))}
        </ul>
        <button onClick={() => onCheckout("annual")} disabled={busy !== null} className="btn-primary w-full">
          {busy === "annual" ? "Redirecting…" : "Start 7-day free trial"}
        </button>
        <button
          onClick={() => onCheckout("monthly")}
          disabled={busy !== null}
          className="w-full text-center font-mono text-[10px] uppercase tracking-widest text-parchment-700 hover:text-parchment-500 transition-colors py-1"
        >
          {busy === "monthly" ? "Redirecting…" : "or go monthly"}
        </button>
        <p className="font-mono text-[10px] text-parchment-700 text-center">No payment due today · Cancel anytime</p>
      </section>
    </>
  );
}
