"use client";

// Small shared form controls used across the settings panels.

// Simple on/off switch.
export function Toggle({
  on,
  busy,
  onClick,
  label,
}: {
  on: boolean;
  busy?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors disabled:opacity-50 ${
        on ? "bg-accent" : "bg-ink-700"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-parchment-100 transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// Segmented single-select control.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex gap-1.5 bg-ink-900 rounded-xl p-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest min-h-[36px] capitalize transition-all ${
            value === opt ? "bg-ink-700 text-parchment-200 shadow-sm" : "text-parchment-700 hover:text-parchment-500"
          }`}
        >
          {labels?.[opt] ?? opt}
        </button>
      ))}
    </div>
  );
}
