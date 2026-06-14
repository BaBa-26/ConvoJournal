"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { format, parseISO } from "date-fns";
import Waveform from "./Waveform";
import { useRecorder } from "@/hooks/useRecorder";
import { buildAutocompleteEngine, type AutocompleteEngine } from "@/lib/autocomplete";
import type { RecordingPhase, ParsedEntry, JournalEntry } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   "#c87a6a",
  medium: "#c8a860",
  low:    "#7a9a7a",
};

// ─── Typing reveal hook ───────────────────────────────────────────────────────

function useTypingReveal(text: string, active: boolean): string {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    if (!active || !text) { setDisplayed(""); indexRef.current = 0; return; }
    indexRef.current = 0;
    setDisplayed("");
    // Speed: aim for ~4s for 200-char text, clamp 8–30ms per char
    const speed = Math.max(8, Math.min(30, 4000 / text.length));
    const interval = setInterval(() => {
      indexRef.current += 2; // reveal 2 chars per tick for smoothness
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, active]);

  return displayed;
}

// ─── Phase components ─────────────────────────────────────────────────────────

function IdlePhase({
  onStart,
  onWrite,
  entries,
  onSelectEntry,
}: {
  onStart: () => void;
  onWrite: () => void;
  entries: JournalEntry[];
  onSelectEntry: (e: JournalEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-8 animate-fade-in">
        <div className="text-center space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-parchment-600">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
          <p className="font-mono text-parchment-400 text-sm mt-3 tracking-wide">
            how are you feeling today?
          </p>
          <p className="font-mono text-parchment-800 text-[11px] tracking-wide">
            speak your mind or write it out
          </p>
        </div>

        <div className="relative flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-gold/20 animate-pulse-ring" />
          <button
            onClick={onStart}
            className="relative w-24 h-24 rounded-full bg-ink-800 border-2 border-gold/50
                       flex items-center justify-center
                       transition-all duration-200 active:scale-95
                       hover:border-gold hover:shadow-gold-glow focus:outline-none"
            aria-label="Start recording"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                 stroke="#c8a878" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="11" rx="3"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8"  y1="23" x2="16" y2="23"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <p className="font-mono text-parchment-700 text-[11px] tracking-[0.15em] uppercase">
            tap to speak
          </p>
          <div className="flex items-center gap-3 w-40">
            <div className="flex-1 h-px bg-ink-700" />
            <span className="font-mono text-[10px] text-parchment-800 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-ink-700" />
          </div>
          <button
            onClick={onWrite}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full
                       border border-ink-700 hover:border-parchment-700/50
                       transition-all duration-200 active:scale-95 focus:outline-none group"
            aria-label="Write your entry"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="#8a7a6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                 className="group-hover:stroke-parchment-500 transition-colors">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-parchment-700
                             group-hover:text-parchment-500 transition-colors">
              write it out
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 gap-5 animate-fade-in">
      {/* Header row with new-entry actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-parchment-600">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
          <p className="font-display italic text-xl text-parchment-200 mt-1">All entries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onWrite}
            className="w-10 h-10 rounded-xl bg-ink-800 border border-ink-700 flex items-center justify-center
                       text-parchment-500 hover:text-parchment-200 hover:border-ink-600
                       transition-all active:scale-95 focus:outline-none"
            aria-label="Write new entry"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button
            onClick={onStart}
            className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center
                       hover:bg-gold/20 hover:border-gold/50
                       transition-all active:scale-95 focus:outline-none"
            aria-label="Record new entry"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="#c8a878" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="11" rx="3"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8"  y1="23" x2="16" y2="23"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Entry list */}
      <div className="flex flex-col gap-3">
        {entries.map(e => (
          <button
            key={e.id}
            onClick={() => onSelectEntry(e)}
            className="text-left bg-ink-900 border border-ink-700 rounded-xl px-4 py-3.5
                       hover:border-ink-600 transition-all duration-150 active:scale-[0.99] focus:outline-none"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-mono text-[10px] text-parchment-700 uppercase tracking-wider">
                {format(parseISO(e.date), "EEE, MMM d")}
              </span>
              {e.mood && (
                <span className="font-mono text-[9px] text-gold/70 border border-gold/20 rounded-full px-2 py-0.5 flex-shrink-0">
                  {e.mood}
                </span>
              )}
            </div>
            <p className="font-display italic text-sm text-parchment-300 leading-relaxed line-clamp-2">
              {e.rawContent.slice(0, 130)}
              {e.rawContent.length > 130 ? "…" : ""}
            </p>
            {((e.tasks?.length ?? 0) > 0 || (e.reminders?.length ?? 0) > 0) && (
              <div className="flex gap-3 mt-2">
                {(e.tasks?.length ?? 0) > 0 && (
                  <span className="font-mono text-[9px] text-parchment-700">
                    {e.tasks!.length} task{e.tasks!.length > 1 ? "s" : ""}
                  </span>
                )}
                {(e.reminders?.length ?? 0) > 0 && (
                  <span className="font-mono text-[9px] text-parchment-700">
                    {e.reminders!.length} reminder{e.reminders!.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function WritingPhase({
  onSubmit,
  onCancel,
  getSuggestions,
}: {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  getSuggestions: (text: string, cursor: number) => string[];
}) {
  const [text, setText]     = useState("");
  const [cursor, setCursor] = useState(0);
  const textareaRef         = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(
    () => (text.length >= 2 ? getSuggestions(text, cursor) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, cursor]
  );

  const updateCursor = (e: React.SyntheticEvent<HTMLTextAreaElement>) =>
    setCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0);

  const insertSuggestion = useCallback(
    (word: string) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const pos = cursor;
      const val = ta.value;

      // Walk back from cursor to find start of the current partial word
      let wordStart = pos;
      while (wordStart > 0 && !/\s/.test(val[wordStart - 1])) wordStart--;

      const newText   = val.slice(0, wordStart) + word + " " + val.slice(pos);
      const newCursor = wordStart + word.length + 1;

      setText(newText);
      setCursor(newCursor);

      requestAnimationFrame(() => {
        ta.selectionStart = newCursor;
        ta.selectionEnd   = newCursor;
        ta.focus();
      });
    },
    [cursor]
  );

  return (
    <div className="flex flex-col flex-1 gap-5 animate-fade-in">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-parchment-600">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
        <p className="font-mono text-parchment-400 text-sm mt-3 tracking-wide">
          how are you feeling today?
        </p>
      </div>

      {/* Suggestion strip */}
      <div className="min-h-[32px] flex items-center">
        {suggestions.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto w-full pb-0.5 scrollbar-none">
            {suggestions.map((s) => (
              <button
                key={s}
                onMouseDown={(e) => { e.preventDefault(); insertSuggestion(s); }}
                className="flex-shrink-0 px-3 py-1 rounded-full
                           bg-ink-800 border border-ink-600
                           font-mono text-[11px] text-parchment-400
                           hover:border-parchment-700/50 hover:text-parchment-300
                           active:scale-95 transition-all duration-100 focus:outline-none"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <p className="font-mono text-[10px] text-parchment-800 tracking-widest">
            suggestions appear as you type
          </p>
        )}
      </div>

      <div className="card flex-1 flex flex-col">
        <textarea
          ref={textareaRef}
          className="flex-1 w-full min-h-[200px] bg-transparent font-mono text-sm
                     text-parchment-300 placeholder-parchment-800 resize-none
                     focus:outline-none leading-7"
          placeholder={"just start writing…\n\nyesterday i finished…\ntoday i need to…\nfeeling pretty…"}
          value={text}
          onChange={(e) => { setText(e.target.value); updateCursor(e); }}
          onSelect={updateCursor}
          onClick={updateCursor}
          onKeyUp={updateCursor}
          autoFocus
        />
        <p className="text-right font-mono text-[10px] text-parchment-800 mt-2">
          {text.length} chars
        </p>
      </div>

      <div className="flex gap-3 sticky bottom-0 bg-ink-950 pb-2">
        <button onClick={onCancel} className="btn-ghost flex-1">
          ← back
        </button>
        <button
          onClick={() => text.trim() && onSubmit(text.trim())}
          disabled={!text.trim()}
          className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Analyse entry
        </button>
      </div>
    </div>
  );
}

function RecordingPhase({ elapsed, onStop }: { elapsed: number; onStop: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-8 animate-fade-in">
      {/* Elapsed timer */}
      <p className="font-display text-5xl text-parchment-300 tracking-tight tabular-nums">
        {formatElapsed(elapsed)}
      </p>

      {/* Waveform */}
      <div className="w-full px-4">
        <Waveform />
      </div>

      {/* Stop button */}
      <button
        onClick={onStop}
        className="flex flex-col items-center gap-2 group focus:outline-none"
        aria-label="Stop recording"
      >
        <div className="w-14 h-14 rounded-full border border-parchment-700/50
                        flex items-center justify-center
                        transition-all duration-150 group-active:scale-95
                        group-hover:border-parchment-500">
          {/* Stop square */}
          <div className="w-5 h-5 rounded-sm bg-parchment-400" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-parchment-700">
          tap to stop
        </span>
      </button>
    </div>
  );
}

function AnalyzingPhase({ transcript }: { transcript: string }) {
  const displayed = useTypingReveal(transcript, true);
  return (
    <div className="flex flex-col flex-1 gap-6 animate-fade-in">
      {/* Status bar */}
      <div className="flex items-center gap-3 pt-2">
        {/* Spinner */}
        <svg className="w-4 h-4 text-gold animate-spin-slow flex-shrink-0"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
                   M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold/80">
          parsing entry…
        </span>
      </div>

      {/* Scrolling transcript with typing cursor */}
      <div className="flex-1 overflow-y-auto">
        <div className="card min-h-[200px]">
          <p className="label mb-3">Entry</p>
          <p className="font-mono text-sm leading-7 text-parchment-300 whitespace-pre-wrap">
            {displayed}
            {/* Blinking cursor */}
            <span className="inline-block w-[2px] h-[14px] bg-gold ml-0.5 align-middle animate-blink" />
          </p>
        </div>
      </div>
    </div>
  );
}

function ReviewPhase({
  transcript,
  parsed,
  onSave,
  onDiscard,
  saving,
}: {
  transcript: string;
  parsed: ParsedEntry;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="flex flex-col flex-1 gap-4 animate-slide-up overflow-y-auto pb-4">
      {/* Mood badge */}
      {parsed.mood && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                           bg-gold/10 border border-gold/25 text-xs font-mono text-gold tracking-wide">
            <span className="text-base leading-none">{moodEmoji(parsed.mood)}</span>
            {parsed.mood}
          </span>
        </div>
      )}

      {/* Yesterday */}
      {parsed.yesterday && (
        <SectionCard color="blue" label="Yesterday" content={parsed.yesterday} />
      )}
      {/* Today */}
      {parsed.today && (
        <SectionCard color="amber" label="Today" content={parsed.today} />
      )}
      {/* Tomorrow */}
      {parsed.tomorrow && (
        <SectionCard color="green" label="Tomorrow / Upcoming" content={parsed.tomorrow} />
      )}

      {/* Extracted tasks */}
      {parsed.tasks?.length > 0 && (
        <div className="card">
          <p className="label mb-3">Tasks ({parsed.tasks.length})</p>
          <div className="space-y-2">
            {parsed.tasks.map((t, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.medium }}
                />
                <div>
                  <p className="text-sm font-mono text-parchment-300">{t.title}</p>
                  {t.dueDate && (
                    <p className="text-[10px] font-mono text-parchment-700 mt-0.5">
                      due {format(new Date(t.dueDate), "MMM d")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted reminders */}
      {parsed.reminders?.length > 0 && (
        <div className="card">
          <p className="label mb-3">Reminders ({parsed.reminders.length})</p>
          <div className="space-y-2">
            {parsed.reminders.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-parchment-600" />
                <div>
                  <p className="text-sm font-mono text-parchment-300">{r.title}</p>
                  <p className="text-[10px] font-mono text-parchment-700 mt-0.5">
                    {format(new Date(r.eventDate), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No content fallback */}
      {!parsed.yesterday && !parsed.today && !parsed.tomorrow &&
       !parsed.tasks?.length && !parsed.reminders?.length && (
        <div className="card text-center py-6">
          <p className="font-mono text-sm text-parchment-700">
            No structure detected — entry saved as raw text.
          </p>
        </div>
      )}

      {/* Raw transcript toggle */}
      <button
        onClick={() => setShowRaw(!showRaw)}
        className="text-left text-[10px] font-mono uppercase tracking-widest text-parchment-700
                   hover:text-parchment-500 transition-colors"
      >
        {showRaw ? "hide" : "show"} transcript ▾
      </button>
      {showRaw && (
        <div className="card">
          <p className="font-mono text-xs text-parchment-600 leading-6 whitespace-pre-wrap">
            {transcript}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2 sticky bottom-0 bg-ink-950 pb-2">
        <button onClick={onDiscard} className="btn-ghost flex-1">
          Discard
        </button>
        <button onClick={onSave} disabled={saving} className="btn-primary flex-1">
          {saving ? "Saving…" : "Save Entry"}
        </button>
      </div>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

const SECTION_STYLES: Record<string, { border: string; labelColor: string; bg: string }> = {
  blue:  { border: "border-blue-900/60",  labelColor: "text-blue-400/70",  bg: "bg-blue-950/30"  },
  amber: { border: "border-amber-900/60", labelColor: "text-amber-400/70", bg: "bg-amber-950/30" },
  green: { border: "border-green-900/60", labelColor: "text-green-400/70", bg: "bg-green-950/30" },
};

function SectionCard({ color, label, content }: { color: string; label: string; content: string }) {
  const s = SECTION_STYLES[color] ?? SECTION_STYLES.amber;
  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-4`}>
      <p className={`text-[10px] font-mono uppercase tracking-[0.2em] mb-2 ${s.labelColor}`}>
        {label}
      </p>
      <p className="font-mono text-sm leading-6 text-parchment-300">{content}</p>
    </div>
  );
}

// ─── Entry detail view ────────────────────────────────────────────────────────

function EntryDetail({
  entry,
  onBack,
}: {
  entry: JournalEntry;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-2 mb-5 text-parchment-600 hover:text-parchment-400
                   transition-colors font-mono text-[11px] uppercase tracking-widest focus:outline-none"
      >
        ← back
      </button>
      <div className="flex-1 overflow-y-auto pb-4 space-y-4">
        <div>
          <p className="font-mono text-[10px] text-parchment-700 uppercase tracking-widest mb-2">
            {format(parseISO(entry.date), "EEEE, MMMM d, yyyy")}
          </p>
          {entry.mood && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                             bg-gold/10 border border-gold/25 text-xs font-mono text-gold tracking-wide">
              <span className="text-base leading-none">{moodEmoji(entry.mood)}</span>
              {entry.mood}
            </span>
          )}
        </div>

        {entry.yesterday && <SectionCard color="blue"  label="Yesterday"          content={entry.yesterday} />}
        {entry.today     && <SectionCard color="amber" label="Today"              content={entry.today}     />}
        {entry.tomorrow  && <SectionCard color="green" label="Tomorrow / Upcoming" content={entry.tomorrow}  />}

        {!entry.yesterday && !entry.today && !entry.tomorrow && (
          <div className="card">
            <p className="font-mono text-sm text-parchment-400 leading-6 whitespace-pre-wrap">
              {entry.rawContent}
            </p>
          </div>
        )}

        {(entry.tasks?.length ?? 0) > 0 && (
          <div className="card">
            <p className="label mb-3">Tasks ({entry.tasks!.length})</p>
            <div className="space-y-2">
              {entry.tasks!.map(t => (
                <div key={t.id} className="flex items-start gap-2.5">
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.medium }}
                  />
                  <p className="font-mono text-sm text-parchment-300">{t.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(entry.reminders?.length ?? 0) > 0 && (
          <div className="card">
            <p className="label mb-3">Reminders ({entry.reminders!.length})</p>
            <div className="space-y-2">
              {entry.reminders!.map(r => (
                <div key={r.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0 bg-parchment-600" />
                  <div>
                    <p className="font-mono text-sm text-parchment-300">{r.title}</p>
                    <p className="font-mono text-[10px] text-parchment-700 mt-0.5">
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

// ─── Mood emoji map ───────────────────────────────────────────────────────────

function moodEmoji(mood: string): string {
  const m = mood.toLowerCase();
  if (/happy|joy|great|good/.test(m))        return "☀";
  if (/sad|down|low/.test(m))                 return "◌";
  if (/stress|anxious|worried|overwhelm/.test(m)) return "◈";
  if (/energet|motiv/.test(m))                return "⚡";
  if (/tired|exhaust/.test(m))                return "◐";
  if (/reflect|thought/.test(m))              return "✦";
  if (/excited|thrilled/.test(m))             return "✧";
  return "◎";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function JournalScreen() {
  const { state: recState, elapsed, transcript, error, startRecording, stopRecording, reset } =
    useRecorder();

  const [phase, setPhase]               = useState<RecordingPhase>("idle");
  const [parsed, setParsed]             = useState<ParsedEntry | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [activeContent, setActiveContent] = useState("");
  const [entries, setEntries]           = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // Autocomplete engine — lazy-init once on first use, persists for session
  const engineRef = useRef<AutocompleteEngine | null>(null);
  const getEngine = useCallback((): AutocompleteEngine => {
    if (!engineRef.current) engineRef.current = buildAutocompleteEngine();
    return engineRef.current;
  }, []);

  const getSuggestions = useCallback(
    (text: string, cursor: number) => getEngine().getSuggestions(text, cursor),
    [getEngine]
  );

  // Fetch journal history — refresh after a new entry is saved
  useEffect(() => {
    fetch("/api/journal")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEntries(data); })
      .catch(() => {});
  }, [saved]);

  // When recorder finishes transcribing → analyze
  useEffect(() => {
    if (recState === "idle" && transcript && phase === "recording") {
      setActiveContent(transcript);
      runAnalysis(transcript);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recState, transcript]);

  // Sync phase with recorder state
  useEffect(() => {
    if (recState === "recording")    setPhase("recording");
    if (recState === "transcribing") setPhase("analyzing");
  }, [recState]);

  const runAnalysis = useCallback(async (text: string) => {
    setPhase("analyzing");
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const result: ParsedEntry = await res.json();
      setParsed(result);
      setPhase("review");
    } catch {
      setAnalyzeError("Could not analyze entry. You can still save it as-is.");
      setParsed({ tasks: [], reminders: [] });
      setPhase("review");
    }
  }, []);

  const handleStart = useCallback(async () => {
    setPhase("recording");
    await startRecording();
  }, [startRecording]);

  const handleStop = useCallback(() => {
    stopRecording();
    setPhase("analyzing");
  }, [stopRecording]);

  const handleWriteSubmit = useCallback((text: string) => {
    setActiveContent(text);
    runAnalysis(text);
  }, [runAnalysis]);

  const handleSave = useCallback(async () => {
    if (!activeContent) return;
    setSaving(true);
    try {
      await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawContent: activeContent, analysis: parsed ?? { tasks: [], reminders: [] } }),
      });
      // Train the local autocomplete model on every saved entry
      getEngine().train(activeContent);
      setSaved(true);
    } catch {
      setAnalyzeError("Failed to save entry.");
    } finally {
      setSaving(false);
    }
  }, [activeContent, parsed]);

  const handleDiscard = useCallback(() => {
    reset();
    setParsed(null);
    setSaved(false);
    setPhase("idle");
    setActiveContent("");
    setSelectedEntry(null);
  }, [reset]);

  // ── Saved confirmation ─────────────────────────────────
  if (saved) {
    const taskCount = parsed?.tasks?.length ?? 0;
    const remCount  = parsed?.reminders?.length ?? 0;
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-fade-in">
        <div className="text-center space-y-3">
          <p className="font-display text-6xl text-gold/60">✦</p>
          <h2 className="font-display text-2xl text-parchment-200">Entry saved</h2>
          <p className="font-mono text-xs text-parchment-600 tracking-wide">
            {taskCount > 0 && `${taskCount} task${taskCount > 1 ? "s" : ""}`}
            {taskCount > 0 && remCount > 0 && " · "}
            {remCount > 0 && `${remCount} reminder${remCount > 1 ? "s" : ""}`}
            {taskCount === 0 && remCount === 0 && "no tasks or reminders extracted"}
          </p>
        </div>
        <button onClick={handleDiscard} className="btn-ghost">
          New entry
        </button>
      </div>
    );
  }

  // Show selected entry detail view
  if (selectedEntry) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-5 pt-safe pt-5 pb-4 flex-shrink-0">
          <h1 className="font-display italic text-2xl text-parchment-200 leading-none">Journal</h1>
        </header>
        <div className="flex-1 overflow-y-auto px-5 flex flex-col">
          <EntryDetail entry={selectedEntry} onBack={() => setSelectedEntry(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden animate-fade-in">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-safe pt-5 pb-4 flex-shrink-0">
        <div>
          <h1 className="font-display italic text-2xl text-parchment-200 leading-none">Journal</h1>
          <p className="font-mono text-[10px] text-parchment-700 mt-1 tracking-widest uppercase">
            {format(new Date(), "MMM d, yyyy")}
          </p>
        </div>
        {/* Phase indicator dots — only shown when in an active phase */}
        {phase !== "idle" && (
          <div className="flex gap-1.5">
            {(["idle","recording","analyzing","review"] as RecordingPhase[]).map((p) => (
              <span
                key={p}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  phase === p ? "bg-gold scale-125" : "bg-ink-600"
                }`}
              />
            ))}
          </div>
        )}
      </header>

      {/* ── Content area ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 flex flex-col">
        {/* Error banner */}
        {(error || analyzeError) && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-priority-high/10 border border-priority-high/30">
            <p className="font-mono text-xs text-priority-high">{error ?? analyzeError}</p>
          </div>
        )}

        {phase === "idle"      && (
          <IdlePhase
            onStart={handleStart}
            onWrite={() => setPhase("writing")}
            entries={entries}
            onSelectEntry={setSelectedEntry}
          />
        )}
        {phase === "writing"   && <WritingPhase onSubmit={handleWriteSubmit} onCancel={() => setPhase("idle")} getSuggestions={getSuggestions} />}
        {phase === "recording" && <RecordingPhase elapsed={elapsed} onStop={handleStop} />}
        {phase === "analyzing" && <AnalyzingPhase transcript={activeContent} />}
        {phase === "review"    && parsed && (
          <ReviewPhase
            transcript={activeContent}
            parsed={parsed}
            onSave={handleSave}
            onDiscard={handleDiscard}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
