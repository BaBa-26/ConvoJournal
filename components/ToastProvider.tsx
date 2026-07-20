"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// A tiny toast system for surfacing mutation failures (and the occasional confirmation).
// Deliberately minimal: one context, one `toast(message)` call, an auto-dismissing stack.
// In-brand copy lives at the call sites — lowercase, second person, says what to do.

type ToastTone = "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = "error") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    timers.current.set(id, setTimeout(() => dismiss(id), DISMISS_MS));
  }, [dismiss]);

  // Clear any pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach((t) => clearTimeout(t)); map.clear(); };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Stack sits above the floating mobile nav pill, centered in the app column. */}
      <div className="fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2
                      px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]
                      md:pb-6 pointer-events-none">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto w-full max-w-[400px] text-left rounded-xl border px-4 py-3
                        font-mono text-xs leading-5 shadow-lg animate-slide-up focus:outline-none
                        ${t.tone === "error"
                          ? "bg-ink-900 border-priority-high/50 text-parchment-300"
                          : "bg-ink-900 border-ink-700 text-parchment-300"}`}
            role="status"
            aria-live="polite"
          >
            <span className="flex items-start gap-2.5">
              <span
                className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0
                            ${t.tone === "error" ? "bg-priority-high" : "bg-accent"}`}
              />
              <span className="flex-1">{t.message}</span>
            </span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Screens call `const { toast } = useToast()`. Safe to call outside a provider (no-op),
// so a component rendered in isolation (tests, storybook) never crashes.
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? { toast: () => {} };
}
