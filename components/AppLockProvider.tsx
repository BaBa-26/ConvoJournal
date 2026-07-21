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
  purgeLegacyGlobalLock,
  MAX_ATTEMPTS,
} from "@/lib/appLock";
import { purgeLegacyAutocomplete } from "@/lib/autocomplete";

// Re-lock after the app has been backgrounded for this long (casual-snoop protection without
// nagging on a quick tab-switch).
const RELOCK_GRACE_MS = 15_000;

// Broadcast from Settings when the PIN is set/changed/removed so the mounted provider re-reads
// its state without a reload.
export const APP_LOCK_CHANGED_EVENT = "progress:appLockChanged";

export default function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const [locked, setLocked] = useState(false);
  const [obscured, setObscured] = useState(false); // blur while backgrounded (app-switcher privacy)
  const [ready, setReady] = useState(false);
  const hiddenAtRef = useRef(0);

  // Drop the pre-namespacing global keys once, on first mount. Both held data written under the
  // old origin-global model (a guest's PIN; journal-derived n-grams), so they're deleted, not
  // migrated. See purgeLegacyGlobalLock / purgeLegacyAutocomplete.
  useEffect(() => {
    purgeLegacyGlobalLock();
    purgeLegacyAutocomplete();
  }, []);

  // Initial evaluation + react to Settings changing the credential. The lock is per-account, so
  // it only ever engages for a signed-in user; while the session is still resolving we hold off
  // rather than flashing either state.
  useEffect(() => {
    if (status === "loading") return;
    const evaluate = () => setLocked(isLockSet(userId) && !isUnlocked(userId));
    evaluate();
    setReady(true);
    window.addEventListener(APP_LOCK_CHANGED_EVENT, evaluate);
    return () => window.removeEventListener(APP_LOCK_CHANGED_EVENT, evaluate);
  }, [status, userId]);

  // Blur on background + re-lock after the grace period.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        setObscured(true);
      } else {
        setObscured(false);
        if (isLockSet(userId) && !isUnlocked(userId)) {
          setLocked(true);
        } else if (isLockSet(userId) && hiddenAtRef.current && Date.now() - hiddenAtRef.current > RELOCK_GRACE_MS) {
          if (userId) setUnlocked(userId, false);
          setLocked(true);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [userId]);

  const handleUnlock = useCallback(() => {
    if (userId) setUnlocked(userId, true);
    setLocked(false);
  }, [userId]);

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

      {ready && locked && userId && (
        <LockScreen userId={userId} onUnlock={handleUnlock} />
      )}
    </>
  );
}

function LockScreen({ userId, onUnlock }: { userId: string; onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [attempts, setAttempts] = useState(() => getAttempts(userId));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const lockedOut = attempts >= MAX_ATTEMPTS;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || busy || lockedOut) return;
    setBusy(true);
    setError(null);
    const { ok, attempts: next } = await verifyPin(userId, pin);
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

  // Recovery. The lock is device-local and per-account, and this screen only renders for a
  // signed-in user — holding a valid session for THIS account is the identity proof. It is a
  // deliberate, labelled action rather than the old two-click path ("Forgot your PIN?" used to
  // fake the lockout state, which exposed removal to anyone holding the device).
  const removeLockNow = () => {
    clearLock(userId);
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

        {!lockedOut && !showRecovery ? (
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
              onClick={() => setShowRecovery(true)}
              className="font-mono text-[11px] text-parchment-600 hover:text-parchment-400 transition-colors"
            >
              Forgot your PIN?
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="font-mono text-[12px] text-parchment-400 leading-6">
              {resetSent
                ? "We've noted the reset request for your account. You can remove the lock below."
                : lockedOut
                ? "Locked out after too many attempts. You're signed in on this device, so you can remove the lock."
                : "You're signed in on this device, so you can remove the lock and set a new PIN."}
            </p>
            {!resetSent && (
              <button onClick={emailReset} disabled={busy} className="btn-ghost w-full">
                {busy ? "Sending…" : "Email me a reset link"}
              </button>
            )}
            <button onClick={removeLockNow} className="btn-primary w-full">
              Remove lock on this device
            </button>
            {!lockedOut && (
              <button
                type="button"
                onClick={() => setShowRecovery(false)}
                className="font-mono text-[11px] text-parchment-600 hover:text-parchment-400 transition-colors"
              >
                Back
              </button>
            )}
            <p className="font-mono text-[10px] text-parchment-700 leading-5">
              Removing the lock clears the PIN for this account on this device. Your journal data
              isn&apos;t affected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
