"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { Attachment, ParsedEntry } from "@/types";
import SectionCard from "@/components/ui/SectionCard";
import Toggle from "@/components/ui/Toggle";
import CrisisSupportCard from "@/components/CrisisSupportCard";
import AttachRow from "./AttachRow";
import { PRIORITY_COLORS, moodEmoji } from "./shared";

// The payoff (design-system §7.4): the structured day assembles with a deliberate
// stagger, and EVERYTHING is correctable before it becomes truth — sections edit in
// place, extracted items rename/remove inline, and the whole structure can be set
// aside for the entry "as spoken" (a plain entry, no extraction).

function saveGateLabel(parsed: ParsedEntry): string {
  const parts: string[] = [];
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (parsed.tasks?.length) parts.push(plural(parsed.tasks.length, "task"));
  if (parsed.goals?.length) parts.push(plural(parsed.goals.length, "goal"));
  if (parsed.reminders?.length) parts.push(plural(parsed.reminders.length, "reminder"));
  if (!parts.length) return "Save your entry";
  const joined =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}`;
  return `Save your ${joined}`;
}

// Inline-editable extracted item row: leading glyph · seamless title input · remove.
function ItemRow({
  lead,
  title,
  meta,
  onTitle,
  onRemove,
  removeLabel,
}: {
  lead: React.ReactNode;
  title: string;
  meta?: string | null;
  onTitle: (v: string) => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="flex items-center gap-2.5 group">
      {lead}
      <div className="flex-1 min-w-0">
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          className="w-full bg-transparent font-mono text-body text-parchment-300
                     focus:outline-none focus:text-parchment-100 rounded
                     border-b border-transparent focus:border-ink-600 transition-colors duration-quick"
          aria-label="Edit item title"
        />
        {meta && <p className="text-label font-mono text-parchment-700 mt-0.5">{meta}</p>}
      </div>
      <button onClick={onRemove} className="row-action" aria-label={removeLabel}>
        <svg
          aria-hidden
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function ReviewPhase({
  transcript,
  parsed,
  onUpdate,
  onSave,
  onDiscard,
  onSignIn,
  saving,
  requiresAuth,
  showPrivateToggle,
  keepPrivate,
  onTogglePrivate,
  mode,
  onModeChange,
  attachments,
  onAttachmentsChange,
}: {
  transcript: string;
  parsed: ParsedEntry;
  onUpdate: (next: ParsedEntry) => void;
  onSave: () => void;
  onDiscard: () => void;
  onSignIn: () => void;
  saving: boolean;
  requiresAuth: boolean;
  showPrivateToggle: boolean;
  keepPrivate: boolean;
  onTogglePrivate: (v: boolean) => void;
  /** "structured" saves the parse; "plain" saves the entry as spoken/written, nothing extracted. */
  mode: "structured" | "plain";
  onModeChange: (m: "structured" | "plain") => void;
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
}) {
  const [showRaw, setShowRaw] = useState(false);

  const hasStructure = Boolean(
    parsed.yesterday ||
      parsed.today ||
      parsed.tomorrow ||
      parsed.tasks?.length ||
      parsed.reminders?.length ||
      parsed.goals?.length
  );

  // Stagger counter — each rendered block takes the next slot (§7.4).
  let riseIndex = 0;
  const rise = () => riseIndex++;

  const setTaskTitle = (i: number, title: string) =>
    onUpdate({ ...parsed, tasks: parsed.tasks.map((t, j) => (j === i ? { ...t, title } : t)) });
  const removeTask = (i: number) =>
    onUpdate({ ...parsed, tasks: parsed.tasks.filter((_, j) => j !== i) });
  const setReminderTitle = (i: number, title: string) =>
    onUpdate({
      ...parsed,
      reminders: parsed.reminders.map((r, j) => (j === i ? { ...r, title } : r)),
    });
  const removeReminder = (i: number) =>
    onUpdate({ ...parsed, reminders: parsed.reminders.filter((_, j) => j !== i) });
  const setGoalTitle = (i: number, title: string) =>
    onUpdate({
      ...parsed,
      goals: (parsed.goals ?? []).map((g, j) => (j === i ? { ...g, title } : g)),
    });
  const removeGoal = (i: number) =>
    onUpdate({ ...parsed, goals: (parsed.goals ?? []).filter((_, j) => j !== i) });

  return (
    <div className="flex flex-col flex-1 gap-4 pb-nav">
      {/* Crisis support — always first, never overlapped (§6.14) */}
      {parsed.risk && parsed.risk.level !== "none" && <CrisisSupportCard risk={parsed.risk} />}

      {/* Structured ⇄ as-spoken choice */}
      <div className="seg animate-rise" style={{ animationDelay: "0ms" }}>
        <button
          onClick={() => onModeChange("structured")}
          className={`seg-item ${mode === "structured" ? "seg-item-active" : ""}`}
          aria-pressed={mode === "structured"}
        >
          structured
        </button>
        <button
          onClick={() => onModeChange("plain")}
          className={`seg-item ${mode === "plain" ? "seg-item-active" : ""}`}
          aria-pressed={mode === "plain"}
        >
          as spoken
        </button>
      </div>

      {mode === "plain" ? (
        // ── Plain view — the words, untouched ──────────────────────────────
        <div className="card animate-rise" style={{ animationDelay: "80ms" }}>
          <p className="label mb-3">Your entry</p>
          <p className="font-mono text-body-lg text-parchment-300 whitespace-pre-wrap">
            {transcript}
          </p>
          <p className="field-hint mt-3">
            saved as written — nothing extracted, nothing rearranged.
          </p>
        </div>
      ) : (
        <>
          {/* Mood — the entry speaking */}
          {parsed.mood && (
            <div className="animate-rise" style={{ animationDelay: `${rise() * 80}ms` }}>
              <span className="pill-mood">
                <span aria-hidden className="text-base leading-none not-italic">
                  {moodEmoji(parsed.mood)}
                </span>
                {parsed.mood}
              </span>
            </div>
          )}

          {parsed.yesterday !== undefined && parsed.yesterday && (
            <SectionCard
              tint="past"
              label="Yesterday"
              content={parsed.yesterday}
              editable
              onChange={(v) => onUpdate({ ...parsed, yesterday: v })}
              index={rise()}
            />
          )}
          {parsed.today !== undefined && parsed.today && (
            <SectionCard
              tint="now"
              label="Today"
              content={parsed.today}
              editable
              onChange={(v) => onUpdate({ ...parsed, today: v })}
              index={rise()}
            />
          )}
          {parsed.tomorrow !== undefined && parsed.tomorrow && (
            <SectionCard
              tint="next"
              label="Tomorrow / Upcoming"
              content={parsed.tomorrow}
              editable
              onChange={(v) => onUpdate({ ...parsed, tomorrow: v })}
              index={rise()}
            />
          )}

          {parsed.tasks?.length > 0 && (
            <div className="card animate-rise" style={{ animationDelay: `${rise() * 80}ms` }}>
              <p className="label mb-3">Tasks ({parsed.tasks.length})</p>
              <div className="space-y-1.5">
                {parsed.tasks.map((t, i) => (
                  <ItemRow
                    key={i}
                    lead={
                      <span
                        aria-hidden
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.medium,
                        }}
                      />
                    }
                    title={t.title}
                    meta={t.dueDate ? `due ${format(new Date(t.dueDate), "MMM d")}` : null}
                    onTitle={(v) => setTaskTitle(i, v)}
                    onRemove={() => removeTask(i)}
                    removeLabel={`Remove task: ${t.title}`}
                  />
                ))}
              </div>
            </div>
          )}

          {(parsed.goals?.length ?? 0) > 0 && (
            <div className="card animate-rise" style={{ animationDelay: `${rise() * 80}ms` }}>
              <p className="label mb-3">Goals ({parsed.goals!.length})</p>
              <div className="space-y-1.5">
                {parsed.goals!.map((g, i) => (
                  <ItemRow
                    key={i}
                    lead={
                      <span aria-hidden className="text-accent/70 text-[13px] leading-none flex-shrink-0">
                        ◆
                      </span>
                    }
                    title={g.title}
                    meta={`${g.target} ${g.unit} · ${g.period}`}
                    onTitle={(v) => setGoalTitle(i, v)}
                    onRemove={() => removeGoal(i)}
                    removeLabel={`Remove goal: ${g.title}`}
                  />
                ))}
              </div>
            </div>
          )}

          {parsed.reminders?.length > 0 && (
            <div className="card animate-rise" style={{ animationDelay: `${rise() * 80}ms` }}>
              <p className="label mb-3">Reminders ({parsed.reminders.length})</p>
              <div className="space-y-1.5">
                {parsed.reminders.map((r, i) => (
                  <ItemRow
                    key={i}
                    lead={
                      <span aria-hidden className="w-2 h-2 rounded-full flex-shrink-0 bg-parchment-600" />
                    }
                    title={r.title}
                    meta={format(new Date(r.eventDate), "MMM d, yyyy")}
                    onTitle={(v) => setReminderTitle(i, v)}
                    onRemove={() => removeReminder(i)}
                    removeLabel={`Remove reminder: ${r.title}`}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasStructure && (
            <div
              className="card text-center py-6 animate-rise"
              style={{ animationDelay: "80ms" }}
            >
              <p className="font-display italic text-body-lg text-parchment-500">
                nothing to extract — your words stand on their own.
              </p>
              <p className="field-hint mt-1">saving keeps the entry exactly as written.</p>
            </div>
          )}

          {/* Raw transcript, one quiet toggle away */}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="btn-quiet self-start -ml-3 text-parchment-600"
            aria-expanded={showRaw}
          >
            {showRaw ? "hide" : "show"} transcript ▾
          </button>
          {showRaw && (
            <div className="card">
              <p className="font-mono text-body text-parchment-600 whitespace-pre-wrap">
                {transcript}
              </p>
            </div>
          )}
        </>
      )}

      {/* Attachments — ride along with the entry in either mode */}
      <div>
        <p className="label mb-2">Attachments</p>
        <AttachRow attachments={attachments} onChange={onAttachmentsChange} />
      </div>

      {/* Keep-on-device — only in sync mode, where there's a server to opt out of */}
      {showPrivateToggle && (
        <div
          className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors duration-quick ${
            keepPrivate ? "bg-accent/10 border-accent/40" : "bg-ink-900 border-ink-700"
          }`}
        >
          <svg
            aria-hidden
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            className={keepPrivate ? "text-accent" : "text-parchment-600"}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <label htmlFor="keep-private" className="flex-1 min-w-0 cursor-pointer">
            <span
              className={`block font-mono text-meta uppercase tracking-wide ${
                keepPrivate ? "text-accent" : "text-parchment-400"
              }`}
            >
              Keep on this device only
            </span>
            <span className="block font-mono text-label text-parchment-700 mt-0.5 normal-case tracking-normal">
              Won&apos;t sync to your account or other devices.
            </span>
          </label>
          <span id="keep-private">
            <Toggle
              checked={keepPrivate}
              onChange={onTogglePrivate}
              ariaLabel="Keep on this device only"
            />
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="action-bar">
        <button onClick={onDiscard} className="btn-ghost flex-1">
          Discard
        </button>
        {requiresAuth ? (
          <button onClick={onSignIn} className="btn-primary flex-1 flex-col gap-0.5 py-2">
            <span className="text-xs leading-none">
              {mode === "plain" ? "Save your entry" : saveGateLabel(parsed)}
            </span>
            <span className="text-[9px] opacity-70 leading-none font-mono tracking-wide">
              sign in — we&apos;ll keep it
            </span>
          </button>
        ) : (
          <button onClick={onSave} disabled={saving} className="btn-primary flex-1">
            {saving ? "Saving…" : "Save Entry"}
          </button>
        )}
      </div>
    </div>
  );
}
