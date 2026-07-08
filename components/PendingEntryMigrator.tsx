"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const PENDING_KEY = "progress:pendingEntry";

// How long a stashed entry stays eligible for migration. The OAuth round-trip takes
// seconds; anything older likely belongs to a different person on a shared device —
// silently importing it into whoever signs in next would be a privacy leak.
const PENDING_TTL_MS = 60 * 60 * 1000; // 60 minutes

// When an unsigned user records their first entry and taps the sign-in gate, JournalScreen
// stashes the entry under PENDING_KEY before the OAuth round-trip. This component — mounted
// once in the root layout — watches for a session appearing and POSTs the stashed entry to
// /api/journal, so the very first entry is never lost across sign-in.
//
// Concurrency: the key is *claimed* (removed) synchronously before the POST and restored on
// failure. This makes the migration idempotent under React strict-mode double effects and
// multiple open tabs — only one runner can hold the value, so tasks are never double-created.
export default function PendingEntryMigrator() {
  const { data: session } = useSession();
  const router = useRouter();
  const migrating = useRef(false);

  useEffect(() => {
    if (!session || migrating.current) return;

    // Claim the pending entry: read + remove atomically (localStorage is synchronous).
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(PENDING_KEY);
      if (raw !== null) window.localStorage.removeItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    // Expired stashes are dropped, not restored — on a shared device a stale entry may
    // belong to someone else, and importing it into this account would leak their words.
    try {
      const stashedAt = new Date(JSON.parse(raw).date ?? 0).getTime();
      if (!Number.isFinite(stashedAt) || Date.now() - stashedAt > PENDING_TTL_MS) return;
    } catch {
      return; // unparseable blob — discard
    }

    migrating.current = true;
    (async () => {
      try {
        const pending = JSON.parse(raw as string);
        const res = await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawContent: pending.raw,
            analysis: pending.analysis ?? { tasks: [], reminders: [] },
          }),
        });
        if (!res.ok) throw new Error("migrate failed");
        router.refresh();
      } catch (error) {
        // Restore the claim so the entry survives to retry on the next load.
        try {
          window.localStorage.setItem(PENDING_KEY, raw as string);
        } catch {}
        migrating.current = false;
        if (process.env.NODE_ENV !== "production") console.error("[pending-entry migrate]", error);
      }
    })();
  }, [session, router]);

  return null;
}
