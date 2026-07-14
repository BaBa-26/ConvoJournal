"use client";

// Quiet layout-editing affordance (design-system §2.6 of the audit: capability stays,
// chrome quiets). A 44px icon button — sliders glyph at rest, accent ✓ while editing.
// Color-mode switching lives in Settings → Appearance, not on the home screen.

export default function EditLayoutButton({
  editing,
  onToggle,
  className = "",
}: {
  editing: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={editing ? "Done editing layout" : "Edit layout"}
      aria-pressed={editing}
      className={`${editing ? "icon-btn-accent" : "icon-btn bg-transparent border-transparent"} ${className}`}
    >
      {editing ? (
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <circle cx="9" cy="7" r="2.2" fill="rgb(var(--ink-900))" />
          <line x1="4" y1="17" x2="20" y2="17" />
          <circle cx="15" cy="17" r="2.2" fill="rgb(var(--ink-900))" />
        </svg>
      )}
    </button>
  );
}
