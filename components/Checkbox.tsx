"use client";

import { useEffect, useState } from "react";

// One checkbox, one behavior — flips instantly, disables mid-flight, rolls back on failure.
// `onToggle(next)` performs the write and returns true on success (the parent has updated its
// `checked` source to `next`) or false on a handled failure (parent unchanged + surfaced a toast).
// A throw counts as failure too. The parent owns the toast copy; the box only owns the motion.
interface CheckboxProps {
  checked: boolean;
  onToggle: (next: boolean) => Promise<boolean>;
  label: string;          // aria-label, e.g. "Mark complete" / "Mark incomplete"
  className?: string;
}

export default function Checkbox({ checked, onToggle, label, className = "" }: CheckboxProps) {
  const [pending, setPending] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const display = optimistic ?? checked;

  // Once the parent's prop catches up to our guess (a committed success), drop the override so
  // there's no flicker back to the old value between "await resolves" and the parent re-render.
  useEffect(() => {
    if (optimistic !== null && checked === optimistic) setOptimistic(null);
  }, [checked, optimistic]);

  const handleClick = async () => {
    if (pending) return;              // no double-taps in flight
    const next = !display;
    setOptimistic(next);             // flip instantly, always
    setPending(true);
    try {
      const ok = await onToggle(next);
      if (ok === false) setOptimistic(null);   // handled failure → roll back to prop
    } catch {
      setOptimistic(null);                       // network throw → roll back
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={display}
      aria-label={label}
      disabled={pending}
      onClick={handleClick}
      className={`flex-shrink-0 -ml-1 p-1 rounded-lg
                  focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/40
                  disabled:cursor-default ${className}`}
    >
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center
                    transition-all duration-150
                    ${display
                      ? "border-transparent bg-accent"
                      : "border-parchment-700 hover:border-accent/60"}`}
      >
        {display && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4L4 7.5L10 1" stroke="#0f0e0b" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </button>
  );
}
