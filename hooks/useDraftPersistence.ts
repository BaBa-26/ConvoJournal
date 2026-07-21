"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ParsedEntry, RecordingPhase } from "@/types";
import { activeLocalAccountId } from "@/lib/localStore";

// Persists an in-progress journal draft to sessionStorage so an accidental tab-off, refresh, or
// memory-pressure tab-discard doesn't vaporize it. sessionStorage (not localStorage) is
// deliberate: tab-scoped, clears on a genuine close — the right lifetime for a half-finished
// thought. A draft is NOT an entry, so it never touches the DB.
// Scoped per account: a draft holds raw journal text, and sessionStorage survives same-tab
// navigation (including the OAuth round-trip), so an unscoped key could surface one person's
// half-written entry in another's "resume" prompt on a handed-over tab.
const DRAFT_KEY_BASE = "progress:draft";
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6h — older than that, it's stale, not a resume

function draftKey(): string {
  const accountId = activeLocalAccountId();
  return accountId ? `${DRAFT_KEY_BASE}:${accountId}` : `${DRAFT_KEY_BASE}:guest`;
}

export interface DraftSnapshot {
  activeContent: string;
  parsed: ParsedEntry | null;
  phase: RecordingPhase;
  keepPrivate: boolean;
  at: number; // epoch ms — used for the freshness check
}

// Read any fresh draft (synchronously, for restore-on-mount). Prunes a stale/corrupt one.
export function readDraft(): DraftSnapshot | null {
  try {
    const raw = sessionStorage.getItem(draftKey());
    if (!raw) return null;
    const d = JSON.parse(raw) as DraftSnapshot;
    if (!d || typeof d.at !== "number" || Date.now() - d.at > MAX_AGE_MS || !d.activeContent) {
      sessionStorage.removeItem(draftKey());
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try { sessionStorage.removeItem(draftKey()); } catch { /* storage unavailable */ }
}

// Writes `snapshot` on every meaningful change AND on tab-hide / navigation (visibilitychange +
// pagehide — NOT beforeunload, which is unreliable on mobile and triggers a native "leave site?"
// prompt). Only persists while `shouldPersist` is true (an actual in-progress draft exists).
export function useDraftPersistence(
  snapshot: Omit<DraftSnapshot, "at">,
  shouldPersist: boolean,
): void {
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const active = useRef(shouldPersist);
  active.current = shouldPersist;

  const flush = useCallback(() => {
    if (!active.current) return;
    try {
      sessionStorage.setItem(draftKey(), JSON.stringify({ ...latest.current, at: Date.now() }));
    } catch { /* storage full/unavailable — nothing else we can do */ }
  }, []);

  // Persist on every meaningful change.
  useEffect(() => {
    if (shouldPersist) flush();
  }, [snapshot.activeContent, snapshot.parsed, snapshot.phase, snapshot.keepPrivate, shouldPersist, flush]);

  // Flush the latest on the way out.
  useEffect(() => {
    const onPageHide = () => flush();
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flush]);
}
