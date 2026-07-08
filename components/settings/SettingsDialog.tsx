"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePreferences } from "@/components/PreferencesProvider";
import Modal from "@/components/Modal";
import { CATEGORIES, ICONS, DEFAULT_CATEGORY, type SettingsCategory } from "./categories";
import AccountPanel from "./panels/AccountPanel";
import PrivacyPanel from "./panels/PrivacyPanel";
import AppearancePanel from "./panels/AppearancePanel";
import NotificationsPanel from "./panels/NotificationsPanel";
import AboutPanel from "./panels/AboutPanel";

export type { SettingsCategory };

export default function SettingsDialog({
  open,
  initialCategory,
  onClose,
}: {
  open: boolean;
  initialCategory: SettingsCategory | null;
  onClose: () => void;
}) {
  const { hasUnsaved, commitPrefs, revertPrefs } = usePreferences();
  const [mounted, setMounted] = useState(false);
  // `cat === null` means the mobile category list is showing; desktop always shows a panel.
  const [cat, setCat] = useState<SettingsCategory | null>(initialCategory);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset the view each time the dialog is opened (respecting a requested category).
  useEffect(() => {
    if (open) setCat(initialCategory);
  }, [open, initialCategory]);

  // Close, honoring the appearance save-gate.
  const attemptClose = () => {
    if (hasUnsaved) setConfirmClose(true);
    else onClose();
  };

  // Scroll lock + stand down swipe-nav while open.
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

  // Escape closes — but let a nested confirm dialog (a second role=dialog) handle it first.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 1) return;
      attemptClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasUnsaved]);

  if (!open || !mounted) return null;

  const activeCat = cat ?? DEFAULT_CATEGORY;

  const renderPanel = (c: SettingsCategory) => {
    switch (c) {
      case "account": return <AccountPanel onClose={onClose} />;
      case "privacy": return <PrivacyPanel onClose={onClose} />;
      case "appearance": return <AppearancePanel />;
      case "notifications": return <NotificationsPanel />;
      case "about": return <AboutPanel onClose={onClose} />;
      case "usage":
        return (
          <div className="card text-center py-10">
            <p className="font-display italic text-lg text-parchment-300">Usage — coming soon</p>
            <p className="font-mono text-[11px] text-parchment-700 mt-2 leading-6">
              Your transcription minutes, entries analyzed, and AI activity will live here.
            </p>
          </div>
        );
    }
  };

  const CatButton = ({
    c,
    label,
    soon,
    variant,
  }: {
    c: SettingsCategory;
    label: string;
    soon?: boolean;
    variant: "rail" | "list";
  }) => {
    const Icon = ICONS[c];
    const active = variant === "rail" && activeCat === c;
    return (
      <button
        onClick={() => !soon && setCat(c)}
        disabled={soon}
        className={`flex items-center gap-3 rounded-xl transition-colors text-left w-full
          ${variant === "rail" ? "px-3 py-2.5" : "px-4 py-3.5 border border-ink-700 bg-ink-900"}
          ${soon ? "opacity-40 cursor-default" : "hover:bg-ink-800"}
          ${active ? "bg-ink-800 text-parchment-200" : "text-parchment-500"}`}
      >
        <Icon className={active ? "text-accent" : "text-parchment-600"} />
        <span className="flex-1 font-mono text-[11px] uppercase tracking-[0.14em]">{label}</span>
        {soon && (
          <span className="font-mono text-[8px] uppercase tracking-widest text-parchment-700 border border-ink-600 rounded-full px-1.5 py-0.5">
            soon
          </span>
        )}
        {variant === "list" && !soon && <span className="text-parchment-700">→</span>}
      </button>
    );
  };

  const activeLabel = CATEGORIES.find((x) => x.key === activeCat)?.label ?? "Settings";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-[60] flex md:items-center md:justify-center md:p-4"
    >
      <div className="absolute inset-0 bg-ink-950/75 backdrop-blur-sm" onClick={attemptClose} aria-hidden />

      <div className="relative w-full h-full md:h-[80vh] md:max-h-[680px] md:max-w-3xl bg-ink-950 md:border md:border-ink-700 md:rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-2xl animate-slide-up">
        {/* ── Mobile: category list ── */}
        <div className={`md:hidden ${cat === null ? "flex" : "hidden"} flex-col flex-1 min-h-0`}>
          <header className="flex items-center justify-between px-5 pt-safe pt-5 pb-4 border-b border-ink-800 flex-shrink-0">
            <h2 className="font-display italic text-2xl text-parchment-100">Settings</h2>
            <button onClick={attemptClose} aria-label="Close settings" className="text-parchment-600 hover:text-parchment-300 text-xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
          </header>
          <nav className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2 pb-nav">
            {CATEGORIES.map((c) => (
              <CatButton key={c.key} c={c.key} label={c.label} soon={c.soon} variant="list" />
            ))}
          </nav>
        </div>

        {/* ── Desktop: category rail ── */}
        <aside className="hidden md:flex flex-col w-56 flex-shrink-0 border-r border-ink-700 bg-ink-950">
          <div className="px-5 pt-6 pb-4">
            <h2 className="font-display italic text-xl text-parchment-100">Settings</h2>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 flex flex-col gap-0.5">
            {CATEGORIES.map((c) => (
              <CatButton key={c.key} c={c.key} label={c.label} soon={c.soon} variant="rail" />
            ))}
          </nav>
          <p className="px-5 py-4 font-mono text-[9px] text-parchment-800 uppercase tracking-widest">Progress · v1.0</p>
        </aside>

        {/* ── Content ── */}
        <section className={`${cat === null ? "hidden md:flex" : "flex"} flex-1 flex-col min-w-0 min-h-0`}>
          <header className="flex items-center gap-2 px-5 pt-safe md:pt-5 pt-5 pb-4 border-b border-ink-800 flex-shrink-0">
            {/* Mobile back */}
            <button
              onClick={() => setCat(null)}
              aria-label="Back to categories"
              className="md:hidden text-parchment-600 hover:text-parchment-300 font-mono text-[11px] uppercase tracking-widest"
            >
              ←
            </button>
            <h3 className="flex-1 font-display italic text-xl text-parchment-100 truncate">{activeLabel}</h3>
            {/* Desktop close */}
            <button
              onClick={attemptClose}
              aria-label="Close settings"
              className="hidden md:flex text-parchment-600 hover:text-parchment-300 text-lg leading-none w-8 h-8 items-center justify-center"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 md:px-6 py-5 pb-nav md:pb-6">
            {renderPanel(activeCat)}
          </div>

          {/* Appearance save-gate */}
          {hasUnsaved && (
            <div className="flex-shrink-0 border-t border-ink-700 bg-ink-900/95 backdrop-blur px-5 py-3 pb-safe flex items-center gap-2">
              <p className="flex-1 font-mono text-[11px] text-parchment-500">Unsaved changes</p>
              <button onClick={revertPrefs} className="btn-ghost px-4 py-2 min-h-[40px]">Discard</button>
              <button onClick={commitPrefs} className="btn-primary px-5 py-2 min-h-[40px]">Save</button>
            </div>
          )}
        </section>
      </div>

      {/* Close-with-unsaved-changes prompt */}
      <Modal open={confirmClose} onClose={() => setConfirmClose(false)}>
        <div className="relative card w-full max-w-sm space-y-4 animate-slide-up">
          <div className="space-y-1">
            <p className="font-display italic text-lg text-parchment-100">Save your changes?</p>
            <p className="font-mono text-xs text-parchment-600 leading-5">
              You have unsaved personalization changes. Save them to apply across the app, or discard.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { commitPrefs(); setConfirmClose(false); onClose(); }}
              className="btn-primary w-full"
            >
              Save &amp; close
            </button>
            <button
              onClick={() => { revertPrefs(); setConfirmClose(false); onClose(); }}
              className="btn-ghost w-full"
            >
              Discard &amp; close
            </button>
            <button
              onClick={() => setConfirmClose(false)}
              className="font-mono text-[11px] text-parchment-600 uppercase tracking-[0.15em] py-2 hover:text-parchment-400 transition-colors"
            >
              Keep editing
            </button>
          </div>
        </div>
      </Modal>
    </div>,
    document.body,
  );
}
