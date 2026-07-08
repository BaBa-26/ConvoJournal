"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  isLockSet,
  isUnlocked,
  setUnlocked,
  verifyPin,
  clearLock,
  getAttempts,
  MAX_ATTEMPTS,
} from "@/lib/appLock";

// Re-lock after the app has been backgrounded for this long (casual-snoop protection without
// nagging on a quick tab-switch).
const RELOCK_GRACE_MS = 15_000;

// Broadcast from Settings when the PIN is set/changed/removed so the mounted provider re-reads
// its state without a reload.
export const APP_LOCK_CHANGED_EVENT = "progress:appLockChanged";

export default function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [locked, setLocked] = useState(false);
  const [obscured, setObscured] = useState(false); // blur while backgrounded (app-switcher privacy)
  const [ready, setReady] = useState(false);
  const hiddenAtRef = useRef(0);

  // Initial evaluation + react to Settings changing the credential.
  useEffect(() => {
    const evaluate = () => setLocked(isLockSet() && !isUnlocked());
    evaluate();
    setReady(true);
    window.addEventListener(APP_LOCK_CHANGED_EVENT, evaluate);
    return () => window.removeEventListener(APP_LOCK_CHANGED_EVENT, evaluate);
  }, []);

  // Blur on background + re-lock after the grace period.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        setObscured(true);
      } else {
        setObscured(false);
        if (isLockSet() && !isUnlocked()) {
          setLocked(true);
        } else if (isLockSet() && hiddenAtRef.current && Date.now() - hiddenAtRef.current > RELOCK_GRACE_MS) {
          setUnlocked(false);
          setLocked(true);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const handleUnlock = useCallback(() => {
    setUnlocked(true);
    setLocked(false);
  }, []);

  return (
    <>
      {children}

      {/* Privacy blur while the app is backgrounded (unlocked). Cheap layer, no state teardown. */}
      {ready && obscured && !locked && (
        <div
          className="fixed inset-0 z-[90] backdrop-blur-xl bg-ink-950/40 pointer-events-none"
          aria-hidden
        />
      )}

      {ready && locked && (
        <LockScreen authenticated={status === "authenticated"} onUnlock={handleUnlock} />
      )}
    </>
  );
}

function LockScreen({ authenticated, onUnlock }: { authenticated: boolean; onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [attempts, setAttempts] = useState(getAttempts());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const lockedOut = attempts >= MAX_ATTEMPTS;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || busy || lockedOut) return;
    setBusy(true);
    setError(null);
    const { ok, attempts: next } = await verifyPin(pin);
    setBusy(false);
    setPin("");
    if (ok) {
      onUnlock();
      return;
    }
    setAttempts(next);
    setError(
      next >= MAX_ATTEMPTS
        ? "Too many attempts."
        : `Incorrect PIN. ${MAX_ATTEMPTS - next} attempt${MAX_ATTEMPTS - next === 1 ? "" : "s"} left.`
    );
  };

  const emailReset = async () => {
    setBusy(true);
    try {
      await fetch("/api/user/app-lock/reset", { method: "POST" });
    } catch {}
    setBusy(false);
    setResetSent(true);
  };

  const removeLockNow = () => {
    // The person is signed into this account on this device — identity enough to lift a
    // device-local lock. (Email delivery for a code-based reset is stubbed for now.)
    clearLock();
    onUnlock();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-ink-950 flex flex-col items-center justify-center px-8 pt-safe pb-safe">
      <div className="w-full max-w-xs space-y-6 text-center">
        <div className="space-y-1">
          <p className="font-mono text-[10px] text-parchment-700 uppercase tracking-[0.2em]">locked</p>
          <h1 className="font-display italic text-2xl text-parchment-100">Enter your PIN</h1>
          <p className="font-mono text-[11px] text-parchment-700">Progress is locked on this device.</p>
        </div>

        {!lockedOut ? (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="input text-center tracking-[0.4em] text-lg"
              placeholder="••••"
            />
            <button type="submit" disabled={!pin || busy} className="btn-primary w-full">
              {busy ? "Checking…" : "Unlock"}
            </button>
            {error && <p className="font-mono text-[11px] text-priority-high">{error}</p>}
            <button
              type="button"
              onClick={() => setAttempts(MAX_ATTEMPTS)}
              className="font-mono text-[11px] text-parchment-600 hover:text-parchment-400 transition-colors"
            >
              Forgot your PIN?
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="font-mono text-[12px] text-parchment-400 leading-6">
              {resetSent
                ? "If this device is signed in, we've noted the reset request. You can remove the lock below."
                : "Locked out after too many attempts. Reset your PIN to get back in."}
            </p>
            {authenticated && !resetSent && (
              <button onClick={emailReset} disabled={busy} className="btn-ghost w-full">
                {busy ? "Sending…" : "Email me a reset link"}
              </button>
            )}
            <button onClick={removeLockNow} className="btn-primary w-full">
              Remove lock on this device
            </button>
            <p className="font-mono text-[10px] text-parchment-700 leading-5">
              {authenticated
                ? "You're signed in on this device, so you can lift the lock. Your journal data isn't affected."
                : "This clears the PIN on this device. Your on-device data isn't affected."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
