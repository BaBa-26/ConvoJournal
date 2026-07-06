"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Order the main tabs cycle through on a horizontal swipe (mobile only). Kept in sync with
// the tab list in components/BottomNav.tsx. Clamped at the ends (no wrap).
export const SWIPE_ORDER = ["/", "/journal", "/schedule", "/tasks"] as const;

const DISTANCE = 60;      // px a horizontal swipe must cover
const DOMINANCE = 1.8;    // horizontal must beat vertical by this factor (ignore scrolls)

// Swipe left/right to move between the main tabs on mobile. Ignores gestures that begin inside
// a `[data-no-swipe]` element (horizontal scrollers, the progress-bar drag), multi-touch, and
// swipes that aren't decisively horizontal.
export function useSwipeNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = () => window.matchMedia("(max-width: 767px)").matches;

    let startX = 0;
    let startY = 0;
    let active = false;

    const onStart = (e: TouchEvent) => {
      if (!isMobile() || e.touches.length !== 1) {
        active = false;
        return;
      }
      // Stand down while a modal (save prompt, edit sheet) owns the screen — otherwise a
      // swipe would navigate away behind the open dialog.
      if (document.body.dataset.modalOpen) {
        active = false;
        return;
      }
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-no-swipe]")) {
        active = false;
        return;
      }
      active = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < DISTANCE || Math.abs(dx) < Math.abs(dy) * DOMINANCE) return;

      const idx = (SWIPE_ORDER as readonly string[]).indexOf(pathRef.current);
      if (idx === -1) return; // not on a swipeable tab
      const nextIdx = dx < 0 ? idx + 1 : idx - 1; // swipe left → next tab
      if (nextIdx < 0 || nextIdx >= SWIPE_ORDER.length) return; // clamp at the ends
      router.push(SWIPE_ORDER[nextIdx]);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router]);
}
