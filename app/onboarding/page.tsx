"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type JournalMode = "voice" | "text" | "both";

const MODES: { value: JournalMode; label: string; sub: string; icon: React.ReactNode }[] = [
  {
    value: "voice",
    label: "Voice first",
    sub: "Speak your brain-dump and let Progress do the rest",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="11" rx="3"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8"  y1="23" x2="16" y2="23"/>
      </svg>
    ),
  },
  {
    value: "text",
    label: "Write it out",
    sub: "Type your thoughts at your own pace",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
  },
  {
    value: "both",
    label: "Mix of both",
    sub: "Voice when it's quick, type when you need precision",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4l3 3"/>
      </svg>
    ),
  },
];

const slide = {
  initial:  { opacity: 0, x: 40 },
  animate:  { opacity: 1, x: 0  },
  exit:     { opacity: 0, x: -40 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [step, setStep]                     = useState(0);
  const [displayName, setDisplayName]       = useState(session?.user?.name ?? "");
  const [journalMode, setJournalMode]       = useState<JournalMode | null>(null);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const totalSteps = 3;

  async function finish() {
    if (!journalMode) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/onboard", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ displayName: displayName.trim() || session?.user?.name || "Friend", journalMode }),
      });
      if (!res.ok) throw new Error();
      // Refresh the NextAuth session so onboarded=true propagates
      await update();
      router.replace("/");
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

          {/* ── Step 0: Welcome ───────────────────────────── */}
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
                  This takes about 30 seconds. Let&apos;s get Progress set up the way you like it.
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

          {/* ── Step 1: Journal style ─────────────────────── */}
          {step === 1 && (
            <motion.div key="step-1" {...slide} className="space-y-8">
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold/70">
                  Your style
                </p>
                <h2 className="font-display italic text-3xl text-parchment-100 leading-snug">
                  How do you like to reflect?
                </h2>
                <p className="font-mono text-sm text-parchment-600 leading-6">
                  We&apos;ll tune the home screen to match. You can always switch mid-session.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {MODES.map(({ value, label, sub, icon }) => (
                  <button
                    key={value}
                    onClick={() => setJournalMode(value)}
                    className={`flex items-start gap-4 text-left px-4 py-4 rounded-2xl border transition-all duration-150 active:scale-[0.98] focus:outline-none ${
                      journalMode === value
                        ? "border-gold/60 bg-gold/5 text-parchment-200"
                        : "border-ink-700 bg-ink-900 text-parchment-500 hover:border-ink-600 hover:text-parchment-300"
                    }`}
                  >
                    <span className={`mt-0.5 flex-shrink-0 ${journalMode === value ? "text-gold" : "text-parchment-700"}`}>
                      {icon}
                    </span>
                    <div>
                      <p className="font-mono text-sm font-medium">{label}</p>
                      <p className="font-mono text-[11px] text-parchment-700 mt-0.5 leading-5">{sub}</p>
                    </div>
                    {journalMode === value && (
                      <span className="ml-auto text-gold mt-0.5">✦</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(0)} className="btn-ghost flex-1">← Back</button>
                <button
                  onClick={() => journalMode && setStep(2)}
                  disabled={!journalMode}
                  className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue →
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
                  <span className="text-parchment-700">Journaling style</span>
                  <span className="text-parchment-300 capitalize">{journalMode}</span>
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
