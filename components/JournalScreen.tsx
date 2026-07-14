"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useRecorder } from "@/hooks/useRecorder";
import { buildAutocompleteEngine, type AutocompleteEngine } from "@/lib/autocomplete";
import type { RecordingPhase as JournalPhase, ParsedEntry, JournalEntry, Attachment } from "@/types";
import {
  loadLocal,
  appendLocalJournalEntry,
  loadPrivateVaultEntries,
  activeLocalAccountId,
} from "@/lib/localStore";
import {
  saveEntryAttachmentsOverlay,
  loadEntryAttachmentsOverlay,
} from "@/lib/attachments";
import { useDataMode } from "@/components/PreferencesProvider";
import { stripRisk, detectCrisisSignals, type RiskSignal } from "@/lib/crisis";
import CrisisSupportCard from "@/components/CrisisSupportCard";
import IdlePhase from "@/components/journal/IdlePhase";
import WritingPhase from "@/components/journal/WritingPhase";
import RecordingPhase from "@/components/journal/RecordingPhase";
import AnalyzingPhase from "@/components/journal/AnalyzingPhase";
import ReviewPhase from "@/components/journal/ReviewPhase";
import EntriesList from "@/components/journal/EntriesList";
import EntryDetail from "@/components/journal/EntryDetail";

// The journal state machine (design-system §7). Presentation lives in
// components/journal/*; this component owns phases, persistence, and recovery:
//   idle → recording → analyzing → review → saved      (voice)
//   idle → writing → analyzing → review → saved        (typed, analysed)
//   idle → writing → saved                             (typed, saved as-is / plain)
//   review can flip structured ⇄ plain before saving   (voice plain entries)
// Failure never strands the user: mic-denied renders a designed idle variant, and
// analysis failure returns their words to the writing surface with both exits.

const ANALYZE_WATCHDOG_MS = 20_000;

export default function JournalScreen() {
  const { data: session } = useSession();
  const dataMode = useDataMode();
  const remote = dataMode === "remote";
  const {
    state: recState,
    elapsed,
    transcript,
    error: recError,
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
    levelRef,
  } = useRecorder();

  const [phase, setPhase] = useState<JournalPhase>("idle");
  const [parsed, setParsed] = useState<ParsedEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedPlain, setSavedPlain] = useState(false);
  const [activeContent, setActiveContent] = useState("");
  const [keepPrivate, setKeepPrivate] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [viewingEntries, setViewingEntries] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [reviewMode, setReviewMode] = useState<"structured" | "plain">("structured");
  const [writingPrefill, setWritingPrefill] = useState("");
  const [writingBanner, setWritingBanner] = useState<string | null>(null);
  const [idleBanner, setIdleBanner] = useState<string | null>(null);
  // Transient crisis signal for plain saves (the review screen never showed it) —
  // zero-retention: state only, never persisted, cleared with the next entry.
  const [plainRisk, setPlainRisk] = useState<RiskSignal | null>(null);
  // Attachments for the in-flight entry — survive writing → review.
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Autocomplete engine — lazy-init once, persists for the session.
  const engineRef = useRef<AutocompleteEngine | null>(null);
  const getEngine = useCallback((): AutocompleteEngine => {
    if (!engineRef.current) engineRef.current = buildAutocompleteEngine();
    return engineRef.current;
  }, []);
  const getSuggestions = useCallback(
    (text: string, cursor: number) => getEngine().getSuggestions(text, cursor),
    [getEngine]
  );

  // Journal history — local mode reads the on-device store; sync mode reads the
  // account and folds in device-only (private) vault entries.
  useEffect(() => {
    if (!remote) {
      setEntries(loadLocal().entries);
      return;
    }
    fetch("/api/journal")
      .then((r) => r.json())
      .then((data) => {
        const remoteEntries = Array.isArray(data) ? data : [];
        // Server entries can't hold attachments yet — fold the on-device overlay back in.
        const account = activeLocalAccountId();
        const withAtts = remoteEntries.map((e: JournalEntry) => {
          const atts = loadEntryAttachmentsOverlay(account, e.date);
          return atts.length ? { ...e, attachments: atts } : e;
        });
        const merged = [...withAtts, ...loadPrivateVaultEntries()].sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        setEntries(merged);
      })
      .catch(() => {});
  }, [saved, remote]);

  const runAnalysis = useCallback(async (text: string) => {
    setPhase("analyzing");
    setWritingBanner(null);
    const controller = new AbortController();
    const watchdog = setTimeout(() => controller.abort(), ANALYZE_WATCHDOG_MS);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Analysis failed");
      const result: ParsedEntry = await res.json();
      setParsed(result);
      setReviewMode("structured");
      setPhase("review");
    } catch {
      // §7.3 — never strand the user: their words return to the writing surface
      // with both exits (retry the analysis, or save as a plain entry).
      setWritingPrefill(text);
      setWritingBanner("couldn't make sense of that — your words are safe here.");
      setPhase("writing");
    } finally {
      clearTimeout(watchdog);
    }
  }, []);

  // Recorder → phase sync.
  useEffect(() => {
    if (recState === "recording") setPhase("recording");
    if (recState === "transcribing") setPhase("analyzing");
  }, [recState]);

  // Transcription finished → analyze.
  useEffect(() => {
    if (recState === "idle" && transcript && phase === "analyzing") {
      setActiveContent(transcript);
      runAnalysis(transcript);
    }
  }, [recState, transcript, phase, runAnalysis]);

  // Transcription failed → back to idle with a calm banner (no eternal spinner).
  useEffect(() => {
    if (recState === "idle" && recError && !transcript && phase === "analyzing") {
      setIdleBanner("couldn't hear that back — want to try again, or write it out?");
      setPhase("idle");
    }
  }, [recState, recError, transcript, phase]);

  const handleStart = useCallback(async () => {
    setIdleBanner(null);
    const ok = await startRecording();
    if (!ok) setMicDenied(true); // phase stays idle — the denied state is designed, not stuck
  }, [startRecording]);

  const handleStop = useCallback(() => {
    stopRecording();
    setPhase("analyzing");
  }, [stopRecording]);

  const handleCancelRecording = useCallback(() => {
    cancelRecording();
    setPhase("idle");
  }, [cancelRecording]);

  const handleWriteSubmit = useCallback(
    (text: string) => {
      setActiveContent(text);
      runAnalysis(text);
    },
    [runAnalysis]
  );

  const persistEntry = useCallback(
    async (content: string, analysis: ParsedEntry) => {
      // Zero-retention: the crisis signal never leaves the client.
      const persistable = stripRisk(analysis);
      if (remote && keepPrivate) {
        appendLocalJournalEntry(content, persistable, true, attachments);
      } else if (remote) {
        await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawContent: content, analysis: persistable }),
        });
        // No server blob storage yet — attachments persist on this device, keyed by
        // the entry's date, and merge back onto the fetched entry (see above).
        if (attachments.length) {
          saveEntryAttachmentsOverlay(
            activeLocalAccountId(),
            new Date().toISOString(),
            attachments
          );
        }
      } else {
        appendLocalJournalEntry(content, persistable, false, attachments);
      }
      getEngine().train(content);
    },
    [remote, keepPrivate, getEngine, attachments]
  );

  // Structured/plain save from the review screen.
  const handleSave = useCallback(async () => {
    if (!activeContent) return;
    setSaving(true);
    try {
      const analysis =
        reviewMode === "plain"
          ? ({ tasks: [], reminders: [] } as ParsedEntry)
          : (parsed ?? { tasks: [], reminders: [] });
      await persistEntry(activeContent, analysis);
      setSavedPlain(reviewMode === "plain");
      setSaved(true);
    } catch {
      setWritingBanner("failed to save — your words are still here.");
      setWritingPrefill(activeContent);
      setPhase("writing");
    } finally {
      setSaving(false);
    }
  }, [activeContent, parsed, reviewMode, persistEntry]);

  // Plain save straight from the writing surface ("save as-is") — no analysis at all.
  // The deterministic crisis layer still runs client-side so support never depends on
  // choosing the parsed flow.
  const handleSavePlain = useCallback(
    async (text: string) => {
      setActiveContent(text);
      const risk = detectCrisisSignals(text);
      if (!session) {
        // Earned sign-in gate: stash, then send to sign in (PendingEntryMigrator posts it).
        try {
          window.localStorage.setItem(
            "progress:pendingEntry",
            JSON.stringify({
              raw: text,
              analysis: { tasks: [], reminders: [] },
              date: new Date().toISOString(),
            })
          );
        } catch {}
        signIn(undefined, { callbackUrl: "/" });
        return;
      }
      setSaving(true);
      try {
        await persistEntry(text, { tasks: [], reminders: [] });
        setPlainRisk(risk.level !== "none" ? risk : null);
        setSavedPlain(true);
        setSaved(true);
      } catch {
        setWritingBanner("failed to save — your words are still here.");
        setWritingPrefill(text);
      } finally {
        setSaving(false);
      }
    },
    [session, persistEntry]
  );

  // Unsigned user on the review screen: stash the analyzed entry across the OAuth
  // round-trip, then sign in.
  const handleSignInToSave = useCallback(() => {
    try {
      const analysis =
        reviewMode === "plain"
          ? { tasks: [], reminders: [] }
          : stripRisk(parsed ?? { tasks: [], reminders: [] });
      window.localStorage.setItem(
        "progress:pendingEntry",
        JSON.stringify({ raw: activeContent, analysis, date: new Date().toISOString() })
      );
    } catch {}
    signIn(undefined, { callbackUrl: "/" });
  }, [activeContent, parsed, reviewMode]);

  const handleDiscard = useCallback(() => {
    reset();
    setParsed(null);
    setSaved(false);
    setSavedPlain(false);
    setPhase("idle");
    setActiveContent("");
    setKeepPrivate(false);
    setSelectedEntry(null);
    setViewingEntries(false);
    setMicDenied(false);
    setReviewMode("structured");
    setWritingPrefill("");
    setWritingBanner(null);
    setIdleBanner(null);
    setPlainRisk(null);
    setAttachments([]);
  }, [reset]);

  // ── Saved — the payoff bridges onward (§7.5) ─────────────────────────────
  if (saved) {
    const taskCount = savedPlain ? 0 : (parsed?.tasks?.length ?? 0);
    const remCount = savedPlain ? 0 : (parsed?.reminders?.length ?? 0);
    const goalCount = savedPlain ? 0 : (parsed?.goals?.length ?? 0);
    const hasItems = taskCount + remCount + goalCount > 0;
    return (
      <div className="flex flex-col flex-1 px-5 pb-nav animate-fade-in overflow-y-auto">
        {plainRisk && (
          <div className="pt-6">
            <CrisisSupportCard risk={plainRisk} />
          </div>
        )}
        <div className="flex flex-col items-center justify-center flex-1 gap-6">
          <div className="text-center space-y-3">
            <p aria-hidden className="font-display text-6xl text-accent/60 animate-breathe">
              ✦
            </p>
            <h2 className="font-display text-voice text-parchment-200">Entry saved</h2>
            <p className="font-mono text-body text-parchment-600 tracking-wide">
              {savedPlain
                ? "kept exactly as you wrote it"
                : hasItems
                  ? [
                      taskCount > 0 && `${taskCount} task${taskCount > 1 ? "s" : ""}`,
                      goalCount > 0 && `${goalCount} goal${goalCount > 1 ? "s" : ""}`,
                      remCount > 0 && `${remCount} reminder${remCount > 1 ? "s" : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "no tasks or reminders extracted"}
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            {hasItems && (
              <Link href="/" className="btn-quiet text-accent-ink/80 hover:text-accent-ink">
                see today&apos;s agenda →
              </Link>
            )}
            <button onClick={handleDiscard} className="btn-ghost px-8">
              New entry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Entry detail ─────────────────────────────────────────────────────────
  if (selectedEntry) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-5 pt-safe pt-5 pb-4 flex-shrink-0">
          <h1 className="font-display italic text-voice text-parchment-200 leading-none">
            Journal
          </h1>
        </header>
        <div className="flex-1 overflow-y-auto px-5 flex flex-col">
          <EntryDetail entry={selectedEntry} onBack={() => setSelectedEntry(null)} />
        </div>
      </div>
    );
  }

  const voiceFlowDots: JournalPhase[] = ["recording", "analyzing", "review"];

  return (
    <div className="flex flex-col flex-1 overflow-hidden animate-fade-in">
      {/* ── Header ─────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-safe pt-5 pb-4 flex-shrink-0">
        <div>
          <h1 className="font-display italic text-voice text-parchment-200 leading-none">
            Journal
          </h1>
          <p className="font-mono text-label text-parchment-700 mt-1 uppercase">
            {format(new Date(), "MMM d, yyyy")}
          </p>
          {!session && (
            <p className="font-mono text-label text-parchment-700/90 mt-1.5 normal-case tracking-wide">
              Try it free · sign in to save your entry
            </p>
          )}
        </div>
        {/* Voice-flow progress dots */}
        {voiceFlowDots.includes(phase) && (
          <div aria-hidden className="flex gap-1.5 mr-12 md:mr-0">
            {voiceFlowDots.map((p) => (
              <span
                key={p}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-calm ${
                  phase === p ? "bg-accent scale-125" : "bg-ink-600"
                }`}
              />
            ))}
          </div>
        )}
      </header>

      {/* ── Content ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 flex flex-col">
        {idleBanner && phase === "idle" && !micDenied && (
          <div className="banner-error mb-4" role="alert">
            <span className="flex-1">{idleBanner}</span>
          </div>
        )}

        {phase === "idle" && !viewingEntries && (
          <IdlePhase
            onStart={handleStart}
            onWrite={() => setPhase("writing")}
            entries={entries}
            onViewEntries={() => setViewingEntries(true)}
            isGuest={!session}
            micDenied={micDenied}
          />
        )}
        {phase === "idle" && viewingEntries && (
          <EntriesList
            entries={entries}
            onBack={() => setViewingEntries(false)}
            onStart={handleStart}
            onWrite={() => setPhase("writing")}
            onSelectEntry={setSelectedEntry}
          />
        )}
        {phase === "writing" && (
          <WritingPhase
            onAnalyze={handleWriteSubmit}
            onSavePlain={handleSavePlain}
            onCancel={() => {
              setWritingPrefill("");
              setWritingBanner(null);
              setPhase("idle");
            }}
            getSuggestions={getSuggestions}
            initialText={writingPrefill}
            banner={writingBanner}
            savingPlain={saving}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />
        )}
        {phase === "recording" && (
          <RecordingPhase
            elapsed={elapsed}
            levelRef={levelRef}
            onStop={handleStop}
            onCancel={handleCancelRecording}
          />
        )}
        {phase === "analyzing" && <AnalyzingPhase transcript={activeContent} />}
        {phase === "review" && parsed && (
          <ReviewPhase
            transcript={activeContent}
            parsed={parsed}
            onUpdate={setParsed}
            onSave={handleSave}
            onDiscard={handleDiscard}
            onSignIn={handleSignInToSave}
            saving={saving}
            requiresAuth={!session}
            showPrivateToggle={remote}
            keepPrivate={keepPrivate}
            onTogglePrivate={setKeepPrivate}
            mode={reviewMode}
            onModeChange={setReviewMode}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />
        )}
      </div>
    </div>
  );
}
