"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { resetDemoState } from "@/lib/demoData";
import {
  demoStoreHasData,
  uploadDemoStoreToAccount,
  uploadVaultToAccount,
  downloadAccountToVault,
} from "@/lib/syncMigration";
import { isLockSet, setPin, changePin, verifyPin, clearLock, setUnlocked } from "@/lib/appLock";
import { APP_LOCK_CHANGED_EVENT } from "@/components/AppLockProvider";
import Modal from "@/components/Modal";
import { usePreferences } from "@/components/PreferencesProvider";
import { Toggle } from "@/components/settings/controls";

// Everything that governs where the journal lives and who can reach it: storage & sync,
// app lock, per-entry privacy, transparency, and export/delete.
export default function PrivacyPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const { storageMode, setStorageMode } = usePreferences();

  // ── Storage & sync ──
  const [syncBusy, setSyncBusy] = useState<null | "on" | "off" | "bring" | "wipe">(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [confirmSyncOff, setConfirmSyncOff] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wipeText, setWipeText] = useState("");
  const [localDataPresent, setLocalDataPresent] = useState(false);
  const [broughtIn, setBroughtIn] = useState(false);

  useEffect(() => {
    if (status === "authenticated") setLocalDataPresent(demoStoreHasData());
  }, [status]);

  const enableSync = async () => {
    setSyncError(null);
    setSyncBusy("on");
    try {
      if (!(await uploadVaultToAccount())) throw new Error();
      setStorageMode("sync");
      router.refresh();
    } catch {
      setSyncError("Couldn't turn on sync. Please try again.");
    } finally {
      setSyncBusy(null);
    }
  };

  const disableSync = async () => {
    setSyncError(null);
    setSyncBusy("off");
    try {
      if (!(await downloadAccountToVault())) throw new Error();
      setStorageMode("local");
      setConfirmSyncOff(false);
      router.refresh();
    } catch {
      setSyncError("Couldn't switch to on-device only. Please try again.");
    } finally {
      setSyncBusy(null);
    }
  };

  const bringLocalIn = async () => {
    setSyncError(null);
    setSyncBusy("bring");
    try {
      if (!(await uploadDemoStoreToAccount())) throw new Error();
      setLocalDataPresent(false);
      setBroughtIn(true);
      router.refresh();
    } catch {
      setSyncError("Couldn't bring your on-device data in. Please try again.");
    } finally {
      setSyncBusy(null);
    }
  };

  const wipeServerData = async () => {
    setSyncError(null);
    setSyncBusy("wipe");
    try {
      const res = await fetch("/api/user/data", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConfirmWipe(false);
      setWipeText("");
      router.refresh();
    } catch {
      setSyncError("Couldn't delete your server copy. Please try again.");
    } finally {
      setSyncBusy(null);
    }
  };

  // ── App lock (PIN, device-local) ──
  const [lockSet, setLockSet] = useState(false);
  const [lockModal, setLockModal] = useState<null | "set" | "change" | "remove">(null);
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockBusy, setLockBusy] = useState(false);

  useEffect(() => {
    setLockSet(isLockSet(userId));
  }, [userId]);

  const openLock = (mode: "set" | "change" | "remove") => {
    setPinCurrent("");
    setPinNew("");
    setPinConfirm("");
    setLockError(null);
    setLockModal(mode);
  };

  const submitLock = async () => {
    setLockError(null);
    // The lock is per-account; there is no such thing as a signed-out lock (the UI below is
    // gated too, this is the belt-and-braces guard).
    if (!userId) return setLockError("Sign in to use the app lock.");
    if (lockModal === "set" || lockModal === "change") {
      if (pinNew.length < 4) return setLockError("Use at least 4 digits.");
      if (pinNew !== pinConfirm) return setLockError("PINs don't match.");
    }
    setLockBusy(true);
    try {
      if (lockModal === "set") {
        await setPin(userId, pinNew);
        setUnlocked(userId, true);
        setLockSet(true);
      } else if (lockModal === "change") {
        const ok = await changePin(userId, pinCurrent, pinNew);
        if (!ok) {
          setLockError("Current PIN is incorrect.");
          return;
        }
        setUnlocked(userId, true);
      } else if (lockModal === "remove") {
        const { ok } = await verifyPin(userId, pinCurrent);
        if (!ok) {
          setLockError("PIN is incorrect.");
          return;
        }
        clearLock(userId);
        setLockSet(false);
      }
      window.dispatchEvent(new Event(APP_LOCK_CHANGED_EVENT));
      setLockModal(null);
    } finally {
      setLockBusy(false);
    }
  };

  // ── Export + delete account ──
  const [exporting, setExporting] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setDataError(null);
    setExporting(true);
    try {
      const res = await fetch("/api/user/export");
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "progress-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDataError("Couldn't export your data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDataError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/user", { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      // Erase on-device journal traces too: the autocomplete corpus is trained on entry
      // text, and try-mode/pending blobs may hold entry content.
      try {
        window.localStorage.removeItem("progress_autocomplete_v1");
        window.localStorage.removeItem("progress-demo-state-v1");
        window.localStorage.removeItem("progress:pendingEntry");
      } catch {}
      await signOut({ callbackUrl: "/" });
    } catch {
      setDeleting(false);
      setDataError("Couldn't delete your account. Please try again.");
    }
  };

  // ── Reset local (try-mode) data ──
  const [resetting, setResetting] = useState(false);
  const handleReset = () => {
    setResetting(true);
    resetDemoState();
    router.refresh();
    setTimeout(() => setResetting(false), 300);
  };

  return (
    <div className="space-y-4">
      {/* ── Storage & sync ── */}
      {status === "authenticated" ? (
        <section className="card space-y-4">
          <p className="label">Storage &amp; sync</p>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-sm text-parchment-200">Sync across devices</p>
              <p className="font-mono text-[11px] text-parchment-700 mt-0.5 leading-5">
                {storageMode === "sync"
                  ? "Saved to your account — your entries follow you to any device you sign into."
                  : "On this device only — new entries stay in this browser and won't sync. Your account copy is kept safe unless you delete it below."}
              </p>
            </div>
            <Toggle
              on={storageMode === "sync"}
              busy={syncBusy !== null}
              label="Sync across devices"
              onClick={() => (storageMode === "sync" ? setConfirmSyncOff(true) : enableSync())}
            />
          </div>

          {syncBusy === "on" && (
            <p className="font-mono text-[11px] text-parchment-600">Uploading your on-device data…</p>
          )}

          {/* Bring pre-sign-in / try-mode data into the account */}
          {localDataPresent && (
            <div className="rounded-xl border border-ink-600 bg-ink-900/60 p-3 space-y-2">
              <p className="font-mono text-[11px] text-parchment-400 leading-5">
                You have journal data saved on this device from before you signed in. Bring it into your account?
              </p>
              <button onClick={bringLocalIn} disabled={syncBusy !== null} className="btn-primary w-full">
                {syncBusy === "bring" ? "Bringing it in…" : "Upload on-device data to my account"}
              </button>
            </div>
          )}
          {broughtIn && (
            <p className="font-mono text-[11px] text-accent">Your on-device data is now in your account.</p>
          )}

          {/* Explicit server-copy wipe — meaningful once you're on-device only */}
          {storageMode === "local" && (
            <button
              onClick={() => {
                setWipeText("");
                setSyncError(null);
                setConfirmWipe(true);
              }}
              className="w-full min-h-[44px] rounded-xl border border-priority-high/40 text-priority-high font-mono text-sm hover:bg-priority-high/10 transition-colors"
            >
              Delete my synced copy from the server
            </button>
          )}

          {syncError && <p className="font-mono text-[11px] text-priority-high">{syncError}</p>}
        </section>
      ) : (
        <section className="card space-y-3">
          <p className="label">Storage &amp; sync</p>
          <p className="font-mono text-sm text-parchment-300 leading-6">
            Your journal is saved on this device only. Sign in to sync it across devices — your entries
            will follow you to any phone or computer you sign into.
          </p>
          <button onClick={() => signIn(undefined, { callbackUrl: "/" })} className="btn-primary w-full">
            Sync across devices
          </button>
        </section>
      )}

      {/* ── App lock ── */}
      <section className="card space-y-3">
        <p className="label">App lock</p>
        <p className="font-mono text-[12px] text-parchment-400 leading-6">
          Require a PIN to open Progress on this device. It&apos;s stored only on this device — never sent
          to the server — and the app also blurs when you switch away.
        </p>
        {status !== "authenticated" ? (
          // The lock is per-account. A signed-out visitor has no account to protect (demo data is
          // throwaway), and letting them set one used to lock out the real owner of this browser.
          <p className="font-mono text-[11px] text-parchment-600">
            Sign in to use the app lock.
          </p>
        ) : lockSet ? (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[11px] text-accent">App lock is on.</p>
            <button onClick={() => openLock("change")} className="btn-ghost w-full">Change PIN</button>
            <button onClick={() => openLock("remove")} className="btn-ghost w-full">Remove lock</button>
          </div>
        ) : (
          <button onClick={() => openLock("set")} className="btn-primary w-full">Set a PIN</button>
        )}
      </section>

      {/* ── Private (device-only) entries ── */}
      <section className="card space-y-3">
        <p className="label">Private entries</p>
        <p className="font-mono text-[12px] text-parchment-400 leading-6">
          When you review an entry while sync is on, flip{" "}
          <span className="text-parchment-200">&ldquo;Keep on this device only&rdquo;</span> to save it
          here instead of your account. Private entries stay in your journal on this device and never
          leave this browser. With sync off, every entry is already private.
        </p>
      </section>

      {/* ── What we store & why (transparency) ── */}
      <section className="card space-y-3">
        <p className="label">Your data, plainly</p>
        <ul className="font-mono text-[12px] text-parchment-400 leading-6 space-y-1.5">
          <li>
            <span className="text-parchment-200">What we keep:</span> your journal entries and the tasks,
            reminders, and goals pulled from them — plus your name and appearance settings.
          </li>
          <li>
            <span className="text-parchment-200">Where:</span>{" "}
            {status === "authenticated" && storageMode === "sync"
              ? "in your account, so it syncs across your devices."
              : "on this device only, in your browser."}{" "}
            You control this above under Storage &amp; sync.
          </li>
          <li>
            <span className="text-parchment-200">AI:</span> audio is transcribed and entries are analyzed to
            extract tasks &amp; reminders. We don&apos;t sell your data or use it for ads.
          </li>
        </ul>
        <Link href="/privacy" onClick={onClose} className="btn-ghost justify-start">Read the full privacy policy</Link>
      </section>

      {/* ── Export / delete (authenticated only) ── */}
      {status === "authenticated" && (
        <section className="card space-y-3">
          <p className="label">Export &amp; delete</p>
          <p className="font-mono text-sm text-parchment-300 leading-6">
            Download everything you&apos;ve saved, or permanently delete your account.
          </p>
          <button onClick={handleExport} disabled={exporting} className="btn-ghost w-full">
            {exporting ? "Preparing…" : "Export my data"}
          </button>
          <button
            onClick={() => {
              setConfirmText("");
              setDataError(null);
              setConfirmDelete(true);
            }}
            className="w-full min-h-[44px] rounded-xl border border-priority-high/40 text-priority-high font-mono text-sm hover:bg-priority-high/10 transition-colors"
          >
            Delete account
          </button>
          {dataError && <p className="font-mono text-[11px] text-priority-high">{dataError}</p>}
        </section>
      )}

      {/* ── Reset local (try-mode) data ── */}
      <section className="card space-y-3">
        <p className="label">Local data</p>
        <p className="font-mono text-sm text-parchment-300 leading-6">
          Clears any try-mode data kept in this browser&apos;s local storage and starts you fresh. Signing in saves your entries to your account instead.
        </p>
        <button onClick={handleReset} disabled={resetting} className="btn-ghost w-full">
          {resetting ? "Resetting…" : "Reset local data"}
        </button>
      </section>

      {/* ═══ Modals ═══ */}

      {/* Delete-account confirmation — requires typing DELETE */}
      <Modal open={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)}>
        <div className="relative card w-full max-w-sm space-y-4 animate-slide-up">
          <div className="space-y-1">
            <p className="font-display italic text-lg text-priority-high">Delete your account?</p>
            <p className="font-mono text-xs text-parchment-600 leading-5">
              This permanently erases your entries, tasks, goals, and reminders. It cannot be undone.
              Type <span className="text-parchment-300">DELETE</span> to confirm.
            </p>
          </div>
          <input
            type="text"
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
          />
          <div className="flex flex-col gap-2">
            <button
              onClick={handleDeleteAccount}
              disabled={confirmText !== "DELETE" || deleting}
              className="w-full min-h-[44px] rounded-xl bg-priority-high text-white font-mono text-sm disabled:opacity-40 transition-opacity"
            >
              {deleting ? "Deleting…" : "Delete my account"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="btn-ghost w-full"
            >
              Cancel
            </button>
          </div>
          {dataError && <p className="font-mono text-[11px] text-priority-high">{dataError}</p>}
        </div>
      </Modal>

      {/* Turn cloud sync OFF — explains that the account copy is kept */}
      <Modal open={confirmSyncOff} onClose={() => syncBusy !== "off" && setConfirmSyncOff(false)}>
        <div className="relative card w-full max-w-sm space-y-4 animate-slide-up">
          <div className="space-y-1">
            <p className="font-display italic text-lg text-parchment-100">Keep data on this device only?</p>
            <p className="font-mono text-xs text-parchment-600 leading-5">
              We&apos;ll copy your account data onto this device, then stop syncing. New entries will stay
              here and won&apos;t appear on your other devices. Your account copy is kept safe on the server —
              you can delete it separately anytime.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={disableSync} disabled={syncBusy === "off"} className="btn-primary w-full">
              {syncBusy === "off" ? "Switching…" : "Switch to on-device only"}
            </button>
            <button
              onClick={() => setConfirmSyncOff(false)}
              disabled={syncBusy === "off"}
              className="btn-ghost w-full"
            >
              Cancel
            </button>
          </div>
          {syncError && <p className="font-mono text-[11px] text-priority-high">{syncError}</p>}
        </div>
      </Modal>

      {/* Delete the server copy — requires typing DELETE */}
      <Modal open={confirmWipe} onClose={() => syncBusy !== "wipe" && setConfirmWipe(false)}>
        <div className="relative card w-full max-w-sm space-y-4 animate-slide-up">
          <div className="space-y-1">
            <p className="font-display italic text-lg text-priority-high">Delete your synced copy?</p>
            <p className="font-mono text-xs text-parchment-600 leading-5">
              This erases the entries, tasks, goals, and reminders stored on the server. Your on-device
              data and your account stay intact. Type <span className="text-parchment-300">DELETE</span> to confirm.
            </p>
          </div>
          <input
            type="text"
            className="input"
            value={wipeText}
            onChange={(e) => setWipeText(e.target.value)}
            placeholder="DELETE"
            autoFocus
          />
          <div className="flex flex-col gap-2">
            <button
              onClick={wipeServerData}
              disabled={wipeText !== "DELETE" || syncBusy === "wipe"}
              className="w-full min-h-[44px] rounded-xl bg-priority-high text-white font-mono text-sm disabled:opacity-40 transition-opacity"
            >
              {syncBusy === "wipe" ? "Deleting…" : "Delete server copy"}
            </button>
            <button
              onClick={() => setConfirmWipe(false)}
              disabled={syncBusy === "wipe"}
              className="btn-ghost w-full"
            >
              Cancel
            </button>
          </div>
          {syncError && <p className="font-mono text-[11px] text-priority-high">{syncError}</p>}
        </div>
      </Modal>

      {/* App lock — set / change / remove PIN */}
      <Modal open={lockModal !== null} onClose={() => !lockBusy && setLockModal(null)}>
        <div className="relative card w-full max-w-sm space-y-4 animate-slide-up">
          <div className="space-y-1">
            <p className="font-display italic text-lg text-parchment-100">
              {lockModal === "set" ? "Set a PIN" : lockModal === "change" ? "Change your PIN" : "Remove app lock"}
            </p>
            <p className="font-mono text-xs text-parchment-600 leading-5">
              {lockModal === "remove"
                ? "Enter your current PIN to turn off the lock."
                : "Use at least 4 digits. You'll enter this to open Progress on this device."}
            </p>
          </div>

          <div className="space-y-2">
            {(lockModal === "change" || lockModal === "remove") && (
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                className="input text-center tracking-[0.3em]"
                placeholder="Current PIN"
                value={pinCurrent}
                onChange={(e) => setPinCurrent(e.target.value)}
              />
            )}
            {(lockModal === "set" || lockModal === "change") && (
              <>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus={lockModal === "set"}
                  className="input text-center tracking-[0.3em]"
                  placeholder={lockModal === "change" ? "New PIN" : "PIN"}
                  value={pinNew}
                  onChange={(e) => setPinNew(e.target.value)}
                />
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  className="input text-center tracking-[0.3em]"
                  placeholder="Confirm PIN"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value)}
                />
              </>
            )}
          </div>

          {lockError && <p className="font-mono text-[11px] text-priority-high">{lockError}</p>}

          <div className="flex flex-col gap-2">
            <button onClick={submitLock} disabled={lockBusy} className="btn-primary w-full">
              {lockBusy
                ? "Saving…"
                : lockModal === "set"
                ? "Turn on app lock"
                : lockModal === "change"
                ? "Update PIN"
                : "Remove lock"}
            </button>
            <button onClick={() => setLockModal(null)} disabled={lockBusy} className="btn-ghost w-full">
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
