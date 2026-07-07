"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { pushSupported, currentSubscription, enablePush, disablePush } from "@/lib/push";

function reasonText(reason?: string): string {
  switch (reason) {
    case "denied":
      return "Permission was blocked. Turn notifications back on for this site in your browser settings, then try again.";
    case "unsupported":
      return "This browser can't receive push notifications.";
    case "no-key":
      return "Push isn't configured on the server yet (missing VAPID key).";
    case "save-failed":
      return "Couldn't save the subscription. Try again.";
    default:
      return "Couldn't enable notifications.";
  }
}

// Per-device opt-in for push. Reminders fire when their time arrives; goals get a daily nudge.
export default function NotificationsSettings() {
  const { data: session } = useSession();
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setSupported(pushSupported());
    currentSubscription()
      .then((s) => setEnabled(!!s))
      .catch(() => {});
  }, []);

  const toggle = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        setMsg("Notifications turned off on this device.");
      } else {
        const res = await enablePush();
        if (res.ok) {
          setEnabled(true);
          setMsg("Notifications enabled on this device.");
        } else {
          setMsg(reasonText(res.reason));
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setMsg(
        res.ok
          ? data.sent
            ? "Test sent — check your notifications."
            : "No subscribed devices found."
          : "Couldn't send the test."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-3">
      <p className="label">Notifications</p>

      {!supported ? (
        <p className="font-mono text-xs text-parchment-700 leading-6">
          This browser doesn&apos;t support push. On iPhone, first add Progress to your Home Screen
          (Share → Add to Home Screen), open it from there, then enable notifications.
        </p>
      ) : !session ? (
        <p className="font-mono text-xs text-parchment-700 leading-6">
          Sign in to get a push when a reminder is due and a daily nudge for goals you haven&apos;t hit.
        </p>
      ) : (
        <>
          <p className="font-mono text-xs text-parchment-700 leading-6">
            Get a push when a reminder is due, plus a daily nudge for goals you haven&apos;t hit
            (at your reminder time). This device only.
          </p>
          {/* Slider toggle — clicking it triggers the browser permission prompt */}
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-parchment-400">
              {busy ? "…" : enabled ? "On · this device" : "Off"}
            </span>
            <button
              role="switch"
              aria-checked={enabled}
              aria-label="Enable notifications"
              onClick={toggle}
              disabled={busy}
              className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors
                          focus:outline-none disabled:opacity-50
                          ${enabled ? "bg-accent" : "bg-ink-700 border border-ink-600"}`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full transition-all duration-200
                            ${enabled ? "left-6 bg-ink-950" : "left-1 bg-parchment-400"}`}
              />
            </button>
          </div>
          {enabled && (
            <button onClick={sendTest} disabled={busy} className="btn-ghost">
              Send test
            </button>
          )}
          {msg && <p className="font-mono text-[11px] text-parchment-500 leading-5">{msg}</p>}
        </>
      )}
    </section>
  );
}
