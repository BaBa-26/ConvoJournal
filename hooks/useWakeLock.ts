"use client";

// Screen Wake Lock — keeps the display awake during a recording so the OS doesn't throttle/
// suspend the page (which stalls MediaRecorder and releases the mic). Imperative module, not a
// React hook: useRecorder calls acquire/release from its recording lifecycle.
//
// Necessary but NOT sufficient — a manual lock or an incoming call still drops the lock, which
// is why useRecorder also has interruption recovery. The visibilitychange re-acquire is
// mandatory: iOS reclaims the lock the instant the page backgrounds.

let sentinel: WakeLockSentinel | null = null;

async function reacquire() {
  if (sentinel !== null && document.visibilityState === "visible") {
    try {
      sentinel = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      /* transient — the next visibility change retries */
    }
  }
}

export async function acquireWakeLock(): Promise<void> {
  try {
    sentinel = (await navigator.wakeLock?.request("screen")) ?? null;
    document.addEventListener("visibilitychange", reacquire);
  } catch {
    /* unsupported or denied — recording still works, just without the keep-awake */
  }
}

export async function releaseWakeLock(): Promise<void> {
  document.removeEventListener("visibilitychange", reacquire);
  try {
    await sentinel?.release();
  } catch {
    /* already released by the OS */
  }
  sentinel = null;
}
