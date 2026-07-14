"use client";

import { format, parseISO } from "date-fns";
import type { JournalEntry } from "@/types";

// The archive. Plain and parsed entries live side by side as equals: parsed entries
// carry their counts; plain entries simply show their words (no empty "0 tasks" meta).

function LockGlyph() {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function EntriesList({
  entries,
  onBack,
  onStart,
  onWrite,
  onSelectEntry,
}: {
  entries: JournalEntry[];
  onBack: () => void;
  onStart: () => void;
  onWrite: () => void;
  onSelectEntry: (e: JournalEntry) => void;
}) {
  return (
    <div className="flex flex-col flex-1 gap-5 animate-fade-in">
      {/* Header row: back + new-entry actions */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="btn-quiet -ml-3 text-parchment-600" aria-label="Back to recording">
            ← back
          </button>
          <p className="font-display italic text-voice text-parchment-200">Past entries</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onWrite} className="icon-btn" aria-label="Write new entry">
            <svg
              aria-hidden
              width="14"
              height="14"
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
          </button>
          <button onClick={onStart} className="icon-btn-accent" aria-label="Record new entry">
            <svg
              aria-hidden
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
        </div>
      </div>

      {/* Entry list */}
      <div className="flex flex-col gap-3 pb-nav">
        {entries.map((e) => {
          const snippet = e.yesterday || e.today || e.tomorrow || e.rawContent;
          const taskCount = e.tasks?.length ?? 0;
          const remCount = e.reminders?.length ?? 0;
          return (
            <button
              key={e.id}
              onClick={() => onSelectEntry(e)}
              className="card-interactive rounded-xl px-4 py-3.5"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="flex items-center gap-1.5 font-mono text-label text-parchment-700 uppercase">
                  {format(parseISO(e.date), "EEE, MMM d").toUpperCase()}
                  {e.private && (
                    <span
                      title="On this device only"
                      className="inline-flex items-center gap-1 text-accent-ink/80 normal-case tracking-normal"
                    >
                      <LockGlyph />
                      device only
                    </span>
                  )}
                </span>
                {e.mood && <span className="pill-mood text-[11px] px-2 py-0.5">{e.mood}</span>}
              </div>
              <p className="font-display italic text-body-lg text-parchment-300 line-clamp-2">
                {snippet.slice(0, 130)}
                {snippet.length > 130 ? "…" : ""}
              </p>
              {(taskCount > 0 || remCount > 0 || (e.attachments?.length ?? 0) > 0) && (
                <div className="flex items-center gap-3 mt-2 font-mono text-label text-parchment-700">
                  {taskCount > 0 && (
                    <span>
                      {taskCount} task{taskCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {taskCount > 0 && remCount > 0 && <span>·</span>}
                  {remCount > 0 && (
                    <span>
                      {remCount} reminder{remCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {/* Attachment hint — up to 3 thumbnail dots (§6.11) */}
                  {(e.attachments?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      {(taskCount > 0 || remCount > 0) && <span className="mr-2">·</span>}
                      {e.attachments!.slice(0, 3).map((a) =>
                        a.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={a.id}
                            src={a.dataUrl}
                            alt=""
                            aria-hidden
                            className="w-5 h-5 rounded object-cover border border-ink-600"
                          />
                        ) : (
                          <span
                            key={a.id}
                            aria-hidden
                            className="w-5 h-5 rounded border border-ink-600 bg-ink-800 flex items-center justify-center text-[7px] text-parchment-600"
                          >
                            ▤
                          </span>
                        )
                      )}
                      <span className="sr-only">{e.attachments!.length} attachments</span>
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
