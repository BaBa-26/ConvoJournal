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

export function setActiveLocalKind(kind: LocalKind): void {
  activeKind = kind;
}

export function getActiveLocalKind(): LocalKind {
  return activeKind;
}

function key(): string {
  return activeKind === "vault" ? VAULT_STORAGE_KEY : DEMO_STORAGE_KEY;
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
  return loadStateFromKey(VAULT_STORAGE_KEY, false).entries.filter((e) => e.private);
}

// Direct vault access (independent of activeKind) — used by the sync-OFF download flow to
// write the account snapshot into the vault before the mode flips.
export function saveVault(state: DemoState): DemoState {
  return saveStateToKey(VAULT_STORAGE_KEY, state);
}

export function resetVault(): DemoState {
  return saveStateToKey(VAULT_STORAGE_KEY, createDemoState());
}
