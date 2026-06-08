"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { Sparkles, ChevronDown, ChevronUp, Save } from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";
import Navigation from "@/components/Navigation";
import type { AnalysisResult, JournalEntry } from "@/types";

type Step = "record" | "review" | "done";

export default function HomePage() {
  const [step, setStep] = useState<Step>("record");
  const [content, setContent] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [savedEntry, setSavedEntry] = useState<JournalEntry | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSections, setShowSections] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleTranscription = useCallback((text: string) => {
    setContent((prev) => (prev ? `${prev} ${text}` : text));
  }, []);

  const handleAnalyze = async () => {
    if (!content.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const result: AnalysisResult = await res.json();
      setAnalysis(result);
      setStep("review");
    } catch {
      setError("Failed to analyze entry. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawContent: content, analysis }),
      });
      if (!res.ok) throw new Error("Save failed");
      const entry: JournalEntry = await res.json();
      setSavedEntry(entry);
      setStep("done");
    } catch {
      setError("Failed to save entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep("record");
    setContent("");
    setAnalysis(null);
    setSavedEntry(null);
    setError(null);
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="px-4 pt-6 pb-4 bg-white border-b border-stone-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">ConvoJournal</h1>
            <p className="text-xs text-stone-400 mt-0.5">{format(new Date(), "EEEE, MMMM d")}</p>
          </div>
          {step !== "record" && (
            <button onClick={handleReset} className="text-xs text-journal-500 font-medium">
              New Entry
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {/* Step: Record */}
        {step === "record" && (
          <div className="space-y-4 animate-fade-in">
            <div className="card">
              <p className="section-label">Voice Input</p>
              <div className="flex justify-center py-4">
                <VoiceRecorder onTranscription={handleTranscription} />
              </div>
            </div>

            {/* Text area */}
            <div className="card">
              <p className="section-label">Your Entry</p>
              <textarea
                className="textarea-journal"
                placeholder="Speak or type... tell me about yesterday, today, and what's coming up."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <p className="text-xs text-stone-400 mt-1 text-right">{content.length} chars</p>
            </div>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <button
              onClick={handleAnalyze}
              disabled={!content.trim() || analyzing}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>Analyzing...</>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze & Extract
                </>
              )}
            </button>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && analysis && (
          <div className="space-y-4 animate-fade-in">
            {/* Mood */}
            {analysis.mood && (
              <div className="card flex items-center gap-3">
                <span className="text-2xl">
                  {moodEmoji(analysis.mood)}
                </span>
                <div>
                  <p className="section-label mb-0">Mood</p>
                  <p className="text-sm font-medium capitalize text-stone-700">{analysis.mood}</p>
                </div>
              </div>
            )}

            {/* Sections toggle */}
            <div className="card">
              <button
                className="flex items-center justify-between w-full"
                onClick={() => setShowSections(!showSections)}
              >
                <p className="section-label mb-0">Parsed Sections</p>
                {showSections ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
              </button>
              {showSections && (
                <div className="mt-3 space-y-3">
                  {analysis.yesterday && (
                    <Section label="Yesterday" color="blue" content={analysis.yesterday} />
                  )}
                  {analysis.today && (
                    <Section label="Today" color="amber" content={analysis.today} />
                  )}
                  {analysis.tomorrow && (
                    <Section label="Tomorrow" color="green" content={analysis.tomorrow} />
                  )}
                </div>
              )}
            </div>

            {/* Tasks */}
            {analysis.tasks?.length > 0 && (
              <div className="card">
                <p className="section-label">Tasks Found ({analysis.tasks.length})</p>
                <div className="space-y-2">
                  {analysis.tasks.map((t, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${priorityDot(t.priority)}`} />
                      <div>
                        <p className="text-sm text-stone-800">{t.title}</p>
                        {t.dueDate && (
                          <p className="text-xs text-stone-400">Due: {format(new Date(t.dueDate), "MMM d")}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reminders */}
            {analysis.reminders?.length > 0 && (
              <div className="card">
                <p className="section-label">Reminders Found ({analysis.reminders.length})</p>
                <div className="space-y-2">
                  {analysis.reminders.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-stone-800">{r.title}</p>
                        <p className="text-xs text-stone-400">{format(new Date(r.eventDate), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep("record")} className="btn-secondary flex-1">
                Edit
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && savedEntry && (
          <div className="space-y-4 animate-fade-in">
            <div className="card text-center py-8">
              <div className="text-4xl mb-3">✅</div>
              <h2 className="text-lg font-semibold text-stone-800">Entry Saved!</h2>
              <p className="text-sm text-stone-500 mt-1">
                {savedEntry.tasks?.length ?? 0} tasks and {savedEntry.reminders?.length ?? 0} reminders created.
              </p>
            </div>
            <button onClick={handleReset} className="btn-primary w-full">
              New Entry
            </button>
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
}

function Section({ label, color, content }: { label: string; color: string; content: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    green: "bg-green-50 border-green-200 text-green-800",
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">{label}</p>
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  );
}

function priorityDot(priority: string) {
  return priority === "high" ? "bg-red-400" : priority === "low" ? "bg-green-400" : "bg-amber-400";
}

function moodEmoji(mood: string): string {
  const m = mood.toLowerCase();
  if (m.includes("happy") || m.includes("joy") || m.includes("great")) return "😊";
  if (m.includes("sad") || m.includes("down")) return "😔";
  if (m.includes("stress") || m.includes("anxious") || m.includes("worried")) return "😰";
  if (m.includes("energetic") || m.includes("motivated")) return "⚡";
  if (m.includes("tired") || m.includes("exhausted")) return "😴";
  if (m.includes("reflective") || m.includes("thoughtful")) return "🤔";
  if (m.includes("excited")) return "🎉";
  return "📝";
}
