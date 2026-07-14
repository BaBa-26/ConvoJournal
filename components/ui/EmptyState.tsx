"use client";

// Empty state (design-system §6.10) — one Voice italic line in the product's
// lowercase, unhurried voice. Never a bare "0 items".

export default function EmptyState({
  line,
  sub,
  action,
  mark = true,
  className = "",
}: {
  /** The Voice line, e.g. "a clear day. start fresh." */
  line: string;
  /** Optional quieter second line (interface voice). */
  sub?: string;
  action?: { label: string; onClick: () => void };
  /** Show the ✦ mark above the line. */
  mark?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center text-center gap-2 py-8 ${className}`}>
      {mark && (
        <p aria-hidden className="font-display text-voice text-accent/50 leading-none mb-1">
          ✦
        </p>
      )}
      <p className="font-display italic text-voice-sm text-parchment-500">{line}</p>
      {sub && <p className="font-mono text-meta text-parchment-700 max-w-[22rem]">{sub}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-quiet mt-1">
          {action.label}
        </button>
      )}
    </div>
  );
}
