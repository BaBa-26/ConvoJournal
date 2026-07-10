import {
  DEMO_STORAGE_KEY,
  loadStateFromKey,
  saveStateToKey,
  createDemoState,
  demoStateIsEmpty,
  demoStateToImportPayload,
  exportToState,
  type DemoState,
} from "@/lib/demoData";
import { vaultKey } from "@/lib/localStore";

// Client-side migration between the on-device stores and the account. The demo store (ephemeral
// try mode) and the vault (signed-in local) are handled explicitly rather than via the "active"
// store, because on sign-in the active store flips to the (empty) vault while the data we want to
// carry over still sits in the demo store.

async function uploadState(state: DemoState): Promise<boolean> {
  if (demoStateIsEmpty(state)) return true; // nothing to upload = success
  const res = await fetch("/api/user/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(demoStateToImportPayload(state)),
  });
  return res.ok;
}

function hasData(key: string, reseed: boolean): boolean {
  return !demoStateIsEmpty(loadStateFromKey(key, reseed));
}

export function demoStoreHasData(): boolean {
  return hasData(DEMO_STORAGE_KEY, true);
}

export function vaultHasData(): boolean {
  return hasData(vaultKey(), false);
}

// Upload the ephemeral try-mode (demo) store into the account, then clear it. Used when a
// signed-in user brings the data they created before signing in into their account.
export async function uploadDemoStoreToAccount(): Promise<boolean> {
  const state = loadStateFromKey(DEMO_STORAGE_KEY, true);
  const ok = await uploadState(state);
  if (ok) saveStateToKey(DEMO_STORAGE_KEY, createDemoState());
  return ok;
}

// Upload the persistent vault into the account, then clear it. Used when turning cloud sync ON.
export async function uploadVaultToAccount(): Promise<boolean> {
  const state = loadStateFromKey(vaultKey(), false);
  const ok = await uploadState(state);
  if (ok) saveStateToKey(vaultKey(), createDemoState());
  return ok;
}

// Download the account snapshot into the vault. Used when turning cloud sync OFF so the user's
// data is available on-device before the app switches to reading local.
export async function downloadAccountToVault(): Promise<boolean> {
  const res = await fetch("/api/user/export");
  if (!res.ok) return false;
  const payload = await res.json();
  saveStateToKey(vaultKey(), exportToState(payload));
  return true;
}
