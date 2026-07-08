// Device-local app lock: a PIN/password that gates the app on this device. The credential is
// stored hashed (SHA-256 over a per-device random salt) in localStorage — never in plaintext,
// never sent to the server. "Unlocked" is a per-session flag so the lock re-engages on cold open.

const LOCK_KEY = "progress:appLock";
const UNLOCK_FLAG = "progress:appUnlocked"; // sessionStorage — cleared when the tab/app fully closes

export const MAX_ATTEMPTS = 5;

interface LockRecord {
  salt: string;
  hash: string;
  attempts: number;
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

function readLock(): LockRecord | null {
  try {
    const raw = window.localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.salt === "string" && typeof parsed?.hash === "string") {
      return { salt: parsed.salt, hash: parsed.hash, attempts: Number(parsed.attempts) || 0 };
    }
  } catch {}
  return null;
}

function writeLock(rec: LockRecord): void {
  try {
    window.localStorage.setItem(LOCK_KEY, JSON.stringify(rec));
  } catch {}
}

export function isLockSet(): boolean {
  return readLock() !== null;
}

export function getAttempts(): number {
  return readLock()?.attempts ?? 0;
}

export async function setPin(pin: string): Promise<void> {
  const salt = randomSaltHex();
  const hash = await hashPin(pin, salt);
  writeLock({ salt, hash, attempts: 0 });
}

// Verify against the stored PIN. Resets the attempt counter on success; increments it on failure
// (persisted, so a page refresh can't reset the lockout). Returns the result + current attempt count.
export async function verifyPin(pin: string): Promise<{ ok: boolean; attempts: number }> {
  const rec = readLock();
  if (!rec) return { ok: true, attempts: 0 };
  const hash = await hashPin(pin, rec.salt);
  const ok = hash === rec.hash;
  const attempts = ok ? 0 : rec.attempts + 1;
  writeLock({ ...rec, attempts });
  return { ok, attempts };
}

export async function changePin(currentPin: string, nextPin: string): Promise<boolean> {
  const { ok } = await verifyPin(currentPin);
  if (!ok) return false;
  await setPin(nextPin);
  return true;
}

export function clearLock(): void {
  try {
    window.localStorage.removeItem(LOCK_KEY);
  } catch {}
  setUnlocked(false);
}

export function isUnlocked(): boolean {
  try {
    return window.sessionStorage.getItem(UNLOCK_FLAG) === "1";
  } catch {
    return false;
  }
}

export function setUnlocked(v: boolean): void {
  try {
    if (v) window.sessionStorage.setItem(UNLOCK_FLAG, "1");
    else window.sessionStorage.removeItem(UNLOCK_FLAG);
  } catch {}
}
