"use client";

// Switch control (design-system §6.8) — a real role="switch" with a 44px hit area.
// Accent-aware: the on-state follows the user's accent preset.

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Required when the switch has no visible label of its own. */
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 p-2.5 -m-2.5 disabled:opacity-40"
    >
      <span
        className={`block relative w-11 h-6 rounded-full transition-colors duration-quick ${
          checked ? "bg-accent/60" : "bg-ink-600"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-parchment-100
                      transition-all duration-quick ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
