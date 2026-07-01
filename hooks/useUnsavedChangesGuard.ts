"use client";

import { useEffect } from "react";

// While `active`, intercepts in-app navigation (clicks on internal <a> links that leave the
// current path) and full-page unloads, so a screen with unsaved edits can prompt the user first.
// On an intercepted in-app click it prevents the navigation and calls `onBlocked(href)`; the
// caller decides whether to save, discard, or stay (and performs the eventual router.push).
export function useUnsavedChangesGuard(active: boolean, onBlocked: (href: string) => void) {
  useEffect(() => {
    if (!active) return;

    const onClick = (e: MouseEvent) => {
      // Ignore modified clicks / non-primary buttons (new tab, etc.) and already-handled events.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // Only guard internal navigations that actually change the path.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      // Capture-phase: stop it reaching the framework's Link handler, then hand off to the caller.
      e.preventDefault();
      e.stopPropagation();
      onBlocked(url.pathname + url.search + url.hash);
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active, onBlocked]);
}
