"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Stripe Checkout redirects back to /?billing=success|cancelled. The webhook that flips
// plan=premium usually lands within a second or two but isn't guaranteed to beat the
// redirect, so we poll entitlements briefly instead of trusting the query param alone.
const POLL_DELAYS_MS = [500, 1500, 3000];

export default function BillingReturnHandler() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "confirmed">("idle");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (!billing) return;
    ran.current = true;

    // Strip the query param immediately so a refresh doesn't re-trigger this.
    router.replace(window.location.pathname);

    if (billing !== "success") return;

    (async () => {
      for (const delay of POLL_DELAYS_MS) {
        await new Promise((r) => setTimeout(r, delay));
        try {
          const ent = await fetch("/api/me/entitlements").then((r) => r.json());
          if (ent.plan === "premium") {
            setStatus("confirmed");
            setTimeout(() => setStatus("idle"), 4000);
            return;
          }
        } catch {
          // keep polling — a transient failure isn't worth surfacing here
        }
      }
    })();
  }, [router]);

  if (status !== "confirmed") return null;

  return (
    <div
      role="status"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      className="fixed left-1/2 -translate-x-1/2 z-50 animate-fade-in
                 flex items-center gap-2 px-4 py-2.5 rounded-full
                 bg-ink-900 border border-gold/40 shadow-gold-glow"
    >
      <span className="text-gold text-sm leading-none">✦</span>
      <span className="font-mono text-xs text-parchment-200 tracking-wide">
        Upgraded to Premium
      </span>
    </div>
  );
}
