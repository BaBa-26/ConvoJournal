import type { ParsedEntry } from "@/types";
import {
  DEMO_STORAGE_KEY,
  VAULT_STORAGE_KEY,
  loadStateFromKey,
  saveStateToKey,
  updateStateAtKey,
  createDemoState,
  withAppendedEntry,
  type DemoState,
} from "@/lib/demoData";

// Which on-device store is active for the current user:
//   "demo"  — signed-out try mode (ephemeral, reseeds daily; the marketing funnel)
//   "vault" — signed-in but cloud sync is OFF (persistent real data, never reseeds)
export type LocalKind = "demo" | "vault";

// Resolved synchronously by PreferencesProvider (during render, before children's effects run)
// so any screen reading local data picks the right backing store without a race. Defaults to
// "demo", which is correct for signed-out and for the first paint.
let activeKind: LocalKind = "demo";
// The signed-in account whose vault is active. The vault key is namespaced by this so two
// accounts on the same browser can never read each other's on-device (sync-OFF) data.
let activeAccountId: string | null = null;

export function setActiveLocalKind(kind: LocalKind, accountId?: string | null): void {
  activeKind = kind;
  activeAccountId = accountId ?? null;
  if (kind === "vault" && activeAccountId) migrateLegacyVault(activeAccountId);
}

export function getActiveLocalKind(): LocalKind {
  return activeKind;
}

// Per-account vault key. Falls back to the bare key only when no account is set (shouldn't happen
// in vault mode) so a stray write still lands somewhere rather than throwing.
export function vaultKey(): string {
  return activeAccountId ? `${VAULT_STORAGE_KEY}:${activeAccountId}` : VAULT_STORAGE_KEY;
}

// One-time migration: before this change the vault used a single global key, so a shared browser
// mixed accounts. Adopt any pre-existing global vault into the FIRST account that signs in after
// the update (only if that account's scoped vault is still empty), then delete the global key so
// it can never bleed into a second account. After this runs once, every account is isolated.
function migrateLegacyVault(accountId: string): void {
  if (typeof window === "undefined") return;
  try {
    const legacy = window.localStorage.getItem(VAULT_STORAGE_KEY);
    if (!legacy) return;
    const scoped = `${VAULT_STORAGE_KEY}:${accountId}`;
    if (!window.localStorage.getItem(scoped)) window.localStorage.setItem(scoped, legacy);
    window.localStorage.removeItem(VAULT_STORAGE_KEY);
  } catch {}
}

function key(): string {
  return activeKind === "vault" ? vaultKey() : DEMO_STORAGE_KEY;
}

// Only the ephemeral demo store reseeds; the vault holds real data and must survive.
function reseed(): boolean {
  return activeKind === "demo";
}

// ─── Mode-aware local persistence (call sites don't need to know the kind) ────

export function loadLocal(): DemoState {
  return loadStateFromKey(key(), reseed());
}

export function saveLocal(state: DemoState): DemoState {
  return saveStateToKey(key(), state);
}

export function updateLocal(updater: (state: DemoState) => DemoState): DemoState {
  return updateStateAtKey(key(), reseed(), updater);
}

export function resetLocal(): DemoState {
  return saveStateToKey(key(), createDemoState());
}

export function appendLocalJournalEntry(
  rawContent: string,
  parsed: ParsedEntry,
  isPrivate = false
): DemoState {
  return updateLocal((state) => withAppendedEntry(state, rawContent, parsed, isPrivate));
}

// The private overlay for sync (remote) mode: journal entries the user chose to keep on this
// device only. They live in the vault even while the account is the main source, and surface
// read-only in the Journal history + Today streak/recent. Their extracted tasks/reminders stay
// nested in the entry (visible when opened) but deliberately do NOT flow into the server-backed
// Tasks/Calendar lists — those operate on server IDs and can't act on local-only rows.
export function loadPrivateVaultEntries(): DemoState["entries"] {
  return loadStateFromKey(vaultKey(), false).entries.filter((e) => e.private);
}

// Direct vault access (independent of activeKind) — used by the sync-OFF download flow to
// write the account snapshot into the vault before the mode flips. Uses the per-account key.
export function saveVault(state: DemoState): DemoState {
  return saveStateToKey(vaultKey(), state);
}

export function resetVault(): DemoState {
  return saveStateToKey(vaultKey(), createDemoState());
}
