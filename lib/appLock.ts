// Device-local app lock: a PIN/password that gates the app on this device. The credential is
// stored hashed (SHA-256 over a per-device random salt) in localStorage — never in plaintext,
// never sent to the server. "Unlocked" is a per-session flag so the lock re-engages on cold open.
//
// SCOPE: the lock is namespaced PER ACCOUNT (`progress:appLock:<userId>`), exactly like the local
// vault (`vaultKey()` in lib/localStore). It used to be a single origin-global key, which meant a
// signed-out guest could set a PIN that locked out the real account owner on that browser — and on
// a shared domain, any visitor could lock the app for whoever used that browser profile next.
// Signed-out visitors have no account to protect (demo data is throwaway), so they get NO lock at
// all: every entry point below requires a userId.

const LOCK_PREFIX = "progress:appLock";
const UNLOCK_PREFIX = "progress:appUnlocked"; // sessionStorage — cleared when the tab/app fully closes

export const MAX_ATTEMPTS = 5;

interface LockRecord {
  salt: string;
  hash: string;
  attempts: number;
}

function lockKey(userId: string): string {
  return `${LOCK_PREFIX}:${userId}`;
}

function unlockKey(userId: string): string {
  return `${UNLOCK_PREFIX}:${userId}`;
}

// One-time cleanup of the pre-namespacing global key. It is DELETED rather than migrated: any
// value sitting there was set under the broken model (possibly by a guest, possibly by a different
// account) so adopting it into an account would just perpetuate the lockout it caused.
export function purgeLegacyGlobalLock(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCK_PREFIX);
    window.sessionStorage.removeItem(UNLOCK_PREFIX);
  } catch {}
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSaltHex(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin: string, saltHex: string): Promise<string> {
  const data = new TextEncoder().encode(`${saltHex}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

function readLock(userId: string): LockRecord | null {
  try {
    const raw = window.localStorage.getItem(lockKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.salt === "string" && typeof parsed?.hash === "string") {
      return { salt: parsed.salt, hash: parsed.hash, attempts: Number(parsed.attempts) || 0 };
    }
  } catch {}
  return null;
}

function writeLock(userId: string, rec: LockRecord): void {
  try {
    window.localStorage.setItem(lockKey(userId), JSON.stringify(rec));
  } catch {}
}

export function isLockSet(userId: string | null | undefined): boolean {
  if (!userId) return false; // no account → no lock (guests can't be locked, or lock anyone out)
  return readLock(userId) !== null;
}

export function getAttempts(userId: string | null | undefined): number {
  if (!userId) return 0;
  return readLock(userId)?.attempts ?? 0;
}

export async function setPin(userId: string, pin: string): Promise<void> {
  const salt = randomSaltHex();
  const hash = await hashPin(pin, salt);
  writeLock(userId, { salt, hash, attempts: 0 });
}

// Verify against the stored PIN. Resets the attempt counter on success; increments it on failure
// (persisted, so a page refresh can't reset the lockout). Returns the result + current attempt count.
export async function verifyPin(userId: string, pin: string): Promise<{ ok: boolean; attempts: number }> {
  const rec = readLock(userId);
  if (!rec) return { ok: true, attempts: 0 };
  const hash = await hashPin(pin, rec.salt);
  const ok = hash === rec.hash;
  const attempts = ok ? 0 : rec.attempts + 1;
  writeLock(userId, { ...rec, attempts });
  return { ok, attempts };
}

export async function changePin(userId: string, currentPin: string, nextPin: string): Promise<boolean> {
  const { ok } = await verifyPin(userId, currentPin);
  if (!ok) return false;
  await setPin(userId, nextPin);
  return true;
}

export function clearLock(userId: string): void {
  try {
    window.localStorage.removeItem(lockKey(userId));
  } catch {}
  setUnlocked(userId, false);
}

export function isUnlocked(userId: string | null | undefined): boolean {
  if (!userId) return true; // nothing to unlock
  try {
    return window.sessionStorage.getItem(unlockKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function setUnlocked(userId: string, v: boolean): void {
  try {
    if (v) window.sessionStorage.setItem(unlockKey(userId), "1");
    else window.sessionStorage.removeItem(unlockKey(userId));
  } catch {}
}
