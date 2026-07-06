"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// A viewport-anchored overlay. It portals to <body> on purpose: every screen root carries
// `animate-fade-in`, whose `forwards` fill leaves a persistent `transform` on the element.
// A transformed ancestor becomes the containing block for `position: fixed` children, so a
// modal rendered inline ends up positioned/clipped by that `overflow-hidden` screen root and
// can be "scrolled away from". Rendering through the body escapes that trap.
//
// While open it also (a) locks page scroll and (b) flags `document.body[data-modal-open]` so
// swipe-navigation stands down (see hooks/useSwipeNavigation).
export default function Modal({
  open,
  onClose,
  children,
  align = "center",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Where the panel sits: bottom-sheet on mobile ("sheet") or centered ("center"). */
  align?: "center" | "sheet";
  labelledBy?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock scroll + mark the modal open so global gestures (swipe nav) stand down.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    body.dataset.modalOpen = "true";
    return () => {
      body.style.overflow = prevOverflow;
      delete body.dataset.modalOpen;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const positionClass =
    align === "sheet" ? "items-end justify-center" : "items-end sm:items-center justify-center";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={`fixed inset-0 z-[60] flex ${positionClass} ${align === "center" ? "p-4" : ""}`}
    >
      {/* Backdrop — sits on top of the page so touches can't reach (and scroll) the content behind. */}
      <div
        className="absolute inset-0 bg-ink-950/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {children}
    </div>,
    document.body,
  );
}
