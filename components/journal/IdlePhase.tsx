"use client";

import { format } from "date-fns";
import RecordButton from "@/components/ui/RecordButton";
import type { JournalEntry } from "@/types";

// Journal landing (design-system §7.2 covers the denied variant).
// The mic is front-and-center; the prompt speaks in the product's Voice (Playfair
// italic) — one quiet secondary action to write instead, no OR-divider ceremony.

export default function IdlePhase({
  onStart,
  onWrite,
  entries,
  onViewEntries,
  isGuest,
  micDenied,
}: {
  onStart: () => void;
  onWrite: () => void;
  entries: JournalEntry[];
  onViewEntries: () => void;
  isGuest: boolean;
  /** The last record attempt failed on mic access — show the recovery state. */
  micDenied: boolean;
}) {
  const latest = entries[0];
  const snippet = latest
    ? (latest.yesterday || latest.today || latest.tomorrow || latest.rawContent).slice(0, 90)
    : null;

  return (
    <div className="flex flex-col flex-1 animate-fade-in pb-nav">
      <div className="flex flex-col items-center justify-center flex-1 gap-7 md:justify-center">
        {/* Prompt — the product speaking (Voice, italic) */}
        <div className="text-center space-y-2">
          <p className="text-label font-mono uppercase text-parchment-600">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
          {micDenied ? (
            <>
              <p className="font-display italic text-voice text-parchment-300 pt-2">
                we can&apos;t hear you yet.
              </p>
              <p className="font-mono text-meta text-parchment-600 max-w-[19rem] mx-auto leading-relaxed pt-1">
                allow microphone access in your browser settings, or write your entry instead.
              </p>
            </>
          ) : (
            <p className="font-display italic text-voice text-parchment-300 pt-2">
              how are you feeling today?
            </p>
          )}
        </div>

        <RecordButton state={micDenied ? "denied" : "idle"} onPress={onStart} size="hero" />

        {micDenied ? (
          <button onClick={onWrite} className="btn-primary px-8">
            write it out instead
          </button>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <p className="font-mono text-label uppercase text-parchment-700">tap to speak</p>
            <button
              onClick={onWrite}
              className="btn-quiet text-parchment-600 hover:text-parchment-400"
              aria-label="Write your entry instead"
            >
              <svg
                aria-hidden
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              or write it out
            </button>
          </div>
        )}

        {isGuest && !micDenied && (
          <p className="font-mono text-meta text-parchment-700 leading-relaxed max-w-[19rem] mx-auto text-center">
            new here? try talking through your day — goals for the week, tasks to get done,
            or something you want to get better at.
          </p>
        )}
      </div>

      {/* Your journal — teaser bar to the archive (only once there's history) */}
      {entries.length > 0 && (
        <button
          onClick={onViewEntries}
          className="card-interactive w-full px-4 py-3.5 flex items-center gap-3"
          aria-label={`View past entries (${entries.length})`}
        >
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-label font-mono uppercase text-parchment-600">
                your journal
              </span>
              <span className="badge-count">{entries.length}</span>
            </div>
            {snippet && (
              <p className="font-display italic text-body-lg text-parchment-500 truncate">
                {snippet}
                {snippet.length >= 90 ? "…" : ""}
              </p>
            )}
          </div>
          <svg
            aria-hidden
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="text-parchment-600 flex-shrink-0"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
