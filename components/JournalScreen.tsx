"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import Waveform from "./Waveform";
import { useRecorder } from "@/hooks/useRecorder";
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

function IdlePhase({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-8 animate-fade-in">
      {/* Tagline */}
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-parchment-600">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
        <p className="font-mono text-parchment-700 text-xs mt-3 tracking-wide">
          speak your mind
        </p>
      </div>

      {/* Mic button with pulse ring */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulse ring */}
        <span className="absolute inset-0 rounded-full bg-gold/20 animate-pulse-ring" />
        <button
          onClick={onStart}
          className="relative w-24 h-24 rounded-full bg-ink-800 border-2 border-gold/50
                     flex items-center justify-center
                     transition-all duration-200 active:scale-95
                     hover:border-gold hover:shadow-gold-glow focus:outline-none"
          aria-label="Start recording"
        >
          {/* Mic SVG — no icon library */}
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
               stroke="#c8a878" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="11" rx="3"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8"  y1="23" x2="16" y2="23"/>
          </svg>
        </button>
      </div>

      <p className="font-mono text-parchment-700 text-[11px] tracking-[0.15em] uppercase">
        tap to begin
      </p>
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
          <p className="label mb-3">Transcript</p>
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

  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [parsed, setParsed] = useState<ParsedEntry | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // When recorder finishes transcribing → analyze
  useEffect(() => {
    if (recState === "idle" && transcript && phase === "recording") {
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

  const handleSave = useCallback(async () => {
    if (!transcript) return;
    setSaving(true);
    try {
      await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawContent: transcript, analysis: parsed ?? { tasks: [], reminders: [] } }),
      });
      setSaved(true);
    } catch {
      setAnalyzeError("Failed to save entry.");
    } finally {
      setSaving(false);
    }
  }, [transcript, parsed]);

  const handleDiscard = useCallback(() => {
    reset();
    setParsed(null);
    setSaved(false);
    setPhase("idle");
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-safe pt-5 pb-4 flex-shrink-0">
        <div>
          <h1 className="font-display text-2xl text-parchment-200 leading-none">murmur</h1>
          <p className="font-mono text-[10px] text-parchment-700 mt-1 tracking-widest uppercase">
            {format(new Date(), "MMM d, yyyy")}
          </p>
        </div>
        {/* Phase indicator dots */}
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
      </header>

      {/* ── Content area ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 flex flex-col">
        {/* Error banner */}
        {(error || analyzeError) && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-priority-high/10 border border-priority-high/30">
            <p className="font-mono text-xs text-priority-high">{error ?? analyzeError}</p>
          </div>
        )}

        {phase === "idle"      && <IdlePhase onStart={handleStart} />}
        {phase === "recording" && <RecordingPhase elapsed={elapsed} onStop={handleStop} />}
        {phase === "analyzing" && <AnalyzingPhase transcript={transcript} />}
        {phase === "review"    && parsed && (
          <ReviewPhase
            transcript={transcript}
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
