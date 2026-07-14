"use client";

import { format, parseISO } from "date-fns";
import type { JournalEntry } from "@/types";
import SectionCard from "@/components/ui/SectionCard";
import { PRIORITY_COLORS, moodEmoji } from "./shared";

// Read view for an archived entry. Parsed entries show their time sections + items;
// plain entries show their words in a single quiet card — equals on the timeline.

export default function EntryDetail({
  entry,
  onBack,
}: {
  entry: JournalEntry;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden animate-fade-in">
      <button onClick={onBack} className="btn-quiet self-start -ml-3 mb-3 text-parchment-600">
        ← back
      </button>
      <div className="flex-1 overflow-y-auto pb-nav space-y-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-label text-parchment-700 uppercase mb-2">
            {format(parseISO(entry.date), "EEEE, MMMM d, yyyy")}
            {entry.private && (
              <span className="inline-flex items-center gap-1 text-accent-ink/80 normal-case tracking-normal">
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
                device only
              </span>
            )}
          </p>
          {entry.mood && (
            <span className="pill-mood">
              <span aria-hidden className="text-base leading-none not-italic">
                {moodEmoji(entry.mood)}
              </span>
              {entry.mood}
            </span>
          )}
        </div>

        {entry.yesterday && <SectionCard tint="past" label="Yesterday" content={entry.yesterday} />}
        {entry.today && <SectionCard tint="now" label="Today" content={entry.today} />}
        {entry.tomorrow && (
          <SectionCard tint="next" label="Tomorrow / Upcoming" content={entry.tomorrow} />
        )}

        {!entry.yesterday && !entry.today && !entry.tomorrow && (
          <div className="card">
            <p className="font-mono text-body-lg text-parchment-400 whitespace-pre-wrap">
              {entry.rawContent}
            </p>
          </div>
        )}

        {/* Attachments — images as a soft gallery, files as quiet rows (§6.11) */}
        {(entry.attachments?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="label">Attachments</p>
            <div className="flex gap-2 flex-wrap">
              {entry.attachments!
                .filter((a) => a.kind === "image")
                .map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={a.id}
                    src={a.dataUrl}
                    alt={a.name}
                    className="rounded-xl border border-ink-700 max-h-[280px] max-w-full object-cover"
                  />
                ))}
            </div>
            {entry.attachments!.filter((a) => a.kind === "file").map((a) => (
              <a
                key={a.id}
                href={a.dataUrl}
                download={a.name}
                className="card-tight flex items-center gap-3 hover:border-ink-600 transition-colors duration-quick"
              >
                <span className="font-mono text-label text-parchment-500 tracking-widest border border-ink-600 rounded px-1.5 py-1">
                  {a.name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE"}
                </span>
                <span className="font-mono text-body text-parchment-300 truncate flex-1">
                  {a.name}
                </span>
                <span className="font-mono text-label text-parchment-700">
                  {(a.size / 1024).toFixed(0)} KB
                </span>
              </a>
            ))}
          </div>
        )}

        {(entry.tasks?.length ?? 0) > 0 && (
          <div className="card">
            <p className="label mb-3">Tasks ({entry.tasks!.length})</p>
            <div className="space-y-2">
              {entry.tasks!.map((t) => (
                <div key={t.id} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.medium }}
                  />
                  <p className="font-mono text-body text-parchment-300">{t.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(entry.reminders?.length ?? 0) > 0 && (
          <div className="card">
            <p className="label mb-3">Reminders ({entry.reminders!.length})</p>
            <div className="space-y-2">
              {entry.reminders!.map((r) => (
                <div key={r.id} className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-parchment-600" />
                  <div>
                    <p className="font-mono text-body text-parchment-300">{r.title}</p>
                    <p className="font-mono text-label text-parchment-700 mt-0.5">
                      {format(parseISO(r.eventDate), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
