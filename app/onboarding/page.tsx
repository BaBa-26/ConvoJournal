"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const slide = {
  initial:  { opacity: 0, x: 40 },
  animate:  { opacity: 1, x: 0  },
  exit:     { opacity: 0, x: -40 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

// Format an "HH:mm" value into a friendly label (e.g. "9:00 PM"). Empty → null.
function formatTime(value: string): string | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function OnboardingPage() {
  const { data: session, update } = useSession();

  const [step, setStep]                 = useState(0);
  const [displayName, setDisplayName]   = useState(session?.user?.name ?? "");
  const [reminderTime, setReminderTime] = useState("");
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const totalSteps = 3;

  // Self-heal: if the user is already onboarded (e.g. a stale client guard bounced them here,
  // or they revisit /onboarding), send them into the app. A hard navigation guarantees a clean
  // server render with the current cookie — no client router-cache staleness.
  useEffect(() => {
    if (session?.user?.onboarded === true) window.location.assign("/");
  }, [session]);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/onboard", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          displayName: displayName.trim() || session?.user?.name || "Friend",
          reminderTime: reminderTime || null,
        }),
      });
      if (!res.ok) throw new Error();
      // Refresh the NextAuth session so onboarded=true propagates into the cookie, then do a
      // HARD navigation (not router.replace) — a clean server render reads the fresh cookie and
      // the DB-authoritative gate in app/page.tsx, sidestepping any client router-cache/JWT race.
      await update();
      window.location.assign("/");
    } catch {
      setError("Something went wrong. Try again.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center px-6 py-12">
      {/* Step dots */}
      <div className="flex gap-2 mb-12">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "bg-gold scale-125" : i < step ? "bg-gold/40" : "bg-ink-600"
            }`}
          />
        ))}
      </div>

      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">

          {/* ── Step 0: Welcome + name ────────────────────── */}
          {step === 0 && (
            <motion.div key="step-0" {...slide} className="space-y-8">
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold/70">
                  Welcome
                </p>
                <h1 className="font-display italic text-3xl text-parchment-100 leading-snug">
                  Good to have you.
                </h1>
                <p className="font-mono text-sm text-parchment-600 leading-6">
                  This takes about 20 seconds. Let&apos;s get Progress set up the way you like it.
                </p>
              </div>

              <div className="space-y-2">
                <label className="label">What should we call you?</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder={session?.user?.name ?? "Your name"}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setStep(1)}
                  autoFocus
                />
                <p className="font-mono text-[10px] text-parchment-800">
                  Pulled from your Google account — change it anytime
                </p>
              </div>

              <button
                onClick={() => setStep(1)}
                className="btn-primary w-full"
              >
                Continue →
              </button>
            </motion.div>
          )}

          {/* ── Step 1: Reminder time (skippable) ─────────── */}
          {step === 1 && (
            <motion.div key="step-1" {...slide} className="space-y-8">
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold/70">
                  Your rhythm
                </p>
                <h2 className="font-display italic text-3xl text-parchment-100 leading-snug">
                  When should we nudge you to reflect?
                </h2>
                <p className="font-mono text-sm text-parchment-600 leading-6">
                  A gentle daily reminder to speak your day. Pick a time that fits — or skip and set it later.
                </p>
              </div>

              <div className="space-y-2">
                <label className="label">Daily reminder</label>
                <input
                  type="time"
                  className="input w-full"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  autoFocus
                />
                <p className="font-mono text-[10px] text-parchment-800">
                  {reminderTime ? `We'll nudge you around ${formatTime(reminderTime)}` : "Optional — you can change or turn this off anytime"}
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-ghost flex-1">← Back</button>
                <button onClick={() => setStep(2)} className="btn-primary flex-1">
                  {reminderTime ? "Continue →" : "Skip →"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Ready ─────────────────────────────── */}
          {step === 2 && (
            <motion.div key="step-2" {...slide} className="space-y-8 text-center">
              <div className="space-y-4">
                <p className="font-display text-6xl text-gold/60">✦</p>
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold/70">
                    All set
                  </p>
                  <h2 className="font-display italic text-3xl text-parchment-100">
                    {`You're ready, ${(displayName.trim() || session?.user?.name || "friend").split(" ")[0]}.`}
                  </h2>
                  <p className="font-mono text-sm text-parchment-600 leading-6 max-w-xs mx-auto">
                    Your first entry is waiting. Speak your day — Progress handles the rest.
                  </p>
                </div>
              </div>

              <div className="bg-ink-900 border border-ink-700 rounded-2xl px-5 py-4 text-left space-y-2">
                <p className="label">Your setup</p>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-parchment-700">Name</span>
                  <span className="text-parchment-300">{displayName.trim() || session?.user?.name}</span>
                </div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-parchment-700">Daily reminder</span>
                  <span className="text-parchment-300">{formatTime(reminderTime) ?? "Off"}</span>
                </div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-parchment-700">Account</span>
                  <span className="text-parchment-300 truncate ml-4">{session?.user?.email}</span>
                </div>
              </div>

              {error && (
                <p className="font-mono text-xs text-priority-high">{error}</p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-ghost flex-1">← Back</button>
                <button
                  onClick={finish}
                  disabled={saving}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Start journaling →"}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
