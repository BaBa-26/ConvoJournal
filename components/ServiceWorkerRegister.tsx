"use client";

import { useEffect } from "react";

// Registers /sw.js once on load so the browser has a background worker ready to receive pushes.
// Renders nothing.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[sw] registration failed", err);
    });
  }, []);
  return null;
}
