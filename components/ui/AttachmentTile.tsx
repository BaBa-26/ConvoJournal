"use client";

import type { Attachment } from "@/types";

// Attachment tile (design-system §6.11) — 64px, ink-800, four states:
// uploading (dimmed thumb + progress ring) · failed (retry) · done · file (non-image).

export type TileStatus = "uploading" | "failed" | "done";

function extLabel(name: string, mime: string): string {
  const dot = name.lastIndexOf(".");
  if (dot > 0 && name.length - dot <= 5) return name.slice(dot + 1).toUpperCase();
  return (mime.split("/")[1] ?? "file").slice(0, 4).toUpperCase();
}

export default function AttachmentTile({
  attachment,
  status,
  name,
  onRemove,
  onRetry,
}: {
  /** Present once processing succeeded. */
  attachment?: Attachment;
  status: TileStatus;
  /** Filename fallback while uploading/failed (no Attachment yet). */
  name?: string;
  onRemove?: () => void;
  onRetry?: () => void;
}) {
  const displayName = attachment?.name ?? name ?? "attachment";

  return (
    <div className="relative flex-shrink-0 group" title={displayName}>
      <div
        className={`w-16 h-16 rounded-lg overflow-hidden bg-ink-800 border flex items-center justify-center
                    transition-colors duration-quick ${
                      status === "failed" ? "border-priority-high/40" : "border-ink-700"
                    }`}
      >
        {attachment?.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.dataUrl}
            alt={displayName}
            className={`w-full h-full object-cover ${status === "uploading" ? "opacity-40" : ""}`}
          />
        ) : (
          <div
            className={`flex flex-col items-center gap-1 ${
              status === "uploading" ? "opacity-40" : ""
            }`}
          >
            <span className="font-mono text-label text-parchment-500 tracking-widest">
              {attachment ? extLabel(attachment.name, attachment.mime) : "…"}
            </span>
          </div>
        )}

        {/* Progress ring */}
        {status === "uploading" && (
          <span
            aria-hidden
            className="absolute inset-0 m-auto w-7 h-7 rounded-full border-2 border-transparent
                       border-t-accent/80 animate-spin-slow"
          />
        )}

        {/* Failed → retry */}
        {status === "failed" && (
          <button
            onClick={onRetry}
            aria-label={`Retry attaching ${displayName}`}
            className="absolute inset-0 flex flex-col items-center justify-center gap-0.5
                       bg-ink-950/60 text-priority-high"
          >
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span className="font-mono text-[8px] uppercase tracking-wider">retry</span>
          </button>
        )}
      </div>

      {/* Remove — always reachable on touch (reduced opacity), full on hover/focus */}
      {status !== "uploading" && onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${displayName}`}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-ink-800 border border-ink-600
                     flex items-center justify-center text-parchment-500
                     opacity-70 hover:opacity-100 focus-visible:opacity-100 hover:text-parchment-200
                     transition-opacity duration-quick"
        >
          <svg
            aria-hidden
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
