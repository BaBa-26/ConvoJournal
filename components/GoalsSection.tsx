"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { startOfWeek } from "date-fns";
import type { Goal, GoalPeriod } from "@/types";
import { loadLocal, updateLocal } from "@/lib/localStore";
import { useDataMode } from "@/components/PreferencesProvider";
import ItemEditModal, { type NewItem } from "@/components/ItemEditModal";
import { convertItemRemote, convertItemDemo } from "@/lib/itemConvert";
import EmptyState from "@/components/ui/EmptyState";

// Goals completed since the start of this week — from live goals in demo mode, or the
// durable Completion log (remote). Feeds the momentum bar so cleared wins still count.
function goalsDoneThisWeek(goals: Goal[]): number {
  const weekStart = startOfWeek(new Date()).getTime();
  return goals.filter(
    (g) => (g.completed || g.current >= g.target) && g.completedAt && new Date(g.completedAt).getTime() >= weekStart
  ).length;
}

const PERIOD_LABEL: Record<GoalPeriod, string> = {
  week:    "this week",
  month:   "this month",
  ongoing: "ongoing",
};

// ─── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal, onStep, onEdit, onDelete,
}: {
  goal: Goal;
  onStep: (goal: Goal, delta: number) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
}) {
  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
  const done = goal.completed || goal.current >= goal.target;
  // The ± buttons apply this amount; it seeds from the goal's custom step but is editable
  // inline for a quick "log N at once" (e.g. read 30 pages) without 30 taps.
  const [amount, setAmount] = useState(Math.max(1, goal.step || 1));

  return (
    <div className={`rounded-xl border p-3.5 space-y-2.5 transition-all
      ${done ? "bg-ink-900/50 border-ink-700/50" : "bg-ink-900 border-ink-700"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-mono text-sm leading-5 ${done ? "text-parchment-500" : "text-parchment-200"}`}>
            {goal.title}
          </p>
          <p className="font-mono text-[10px] text-parchment-700 mt-0.5 tracking-wide">
            <span className="text-accent">{goal.current}</span> / {goal.target} {goal.unit}
            <span className="text-parchment-800"> · {PERIOD_LABEL[goal.period] ?? goal.period}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(goal)}
            aria-label="Edit goal"
            className="p-1 text-parchment-800 hover:text-parchment-400 transition-colors focus:outline-none"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(goal.id)}
            aria-label="Delete goal"
            className="p-1 text-parchment-800 hover:text-priority-high transition-colors focus:outline-none"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${done ? "bg-priority-low" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steppers — ± apply the editable amount (defaults to the goal's step) */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-parchment-800">
          {done ? "complete" : `${pct}%`}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onStep(goal, -amount)}
            disabled={goal.current <= 0}
            aria-label={`Subtract ${amount} ${goal.unit}`}
            className="w-8 h-8 rounded-lg border border-ink-700 text-parchment-500
                       hover:border-parchment-700/60 hover:text-parchment-300 transition-all
                       disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none
                       flex items-center justify-center text-base leading-none"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Math.min(100_000, parseInt(e.target.value, 10) || 1)))}
            aria-label="Amount to log"
            className="w-12 h-8 text-center bg-ink-800 border border-ink-700 rounded-lg
                       font-mono text-xs text-parchment-300 focus:outline-none focus:border-accent/50
                       [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => onStep(goal, amount)}
            disabled={goal.current >= goal.target}
            aria-label={`Add ${amount} ${goal.unit}`}
            className="w-8 h-8 rounded-lg border border-accent/40 text-accent
                       hover:bg-accent/10 transition-all
                       disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none
                       flex items-center justify-center text-base leading-none"
          >
            +
          </button>
        </div>
      </div>

      {done && (
        <p className="font-mono text-[9px] text-parchment-800 tracking-wide pt-0.5">
          clears in 24h — the win still counts, we just tidy it out of the way.
        </p>
      )}
    </div>
  );
}

// ─── Add / edit form ──────────────────────────────────────────────────────────

interface GoalDraft {
  title: string;
  target: number;
  unit: string;
  step: number;
  period: GoalPeriod;
  current?: number;
}

function GoalForm({
  initial, onSubmit, onCancel,
}: {
  initial?: Goal;
  onSubmit: (draft: GoalDraft) => void;
  onCancel: () => void;
}) {
  const [title,  setTitle]  = useState(initial?.title ?? "");
  const [target, setTarget] = useState(String(initial?.target ?? 7));
  const [unit,   setUnit]   = useState(initial?.unit ?? "days");
  const [step,   setStep]   = useState(String(initial?.step ?? 1));
  const [period, setPeriod] = useState<GoalPeriod>(initial?.period ?? "week");

  const handleSubmit = () => {
    const t = parseInt(target, 10);
    if (!title.trim() || isNaN(t) || t < 1) return;
    const s = Math.max(1, parseInt(step, 10) || 1);
    onSubmit({ title: title.trim(), target: t, unit: unit.trim() || "times", step: s, period, current: initial?.current });
  };

  return (
    <div className="card space-y-3 animate-slide-up">
      <p className="label">{initial ? "Edit goal" : "New goal"}</p>

      <input
        className="input"
        placeholder="e.g. Go to the gym"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          className="input w-24"
          placeholder="7"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="Target"
        />
        <input
          className="input flex-1"
          placeholder="unit (days, pages…)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          aria-label="Unit"
        />
      </div>

      <div>
        <div className="flex items-center gap-2">
          <label className="font-mono text-[10px] uppercase tracking-wider text-parchment-700 whitespace-nowrap">
            step by
          </label>
          <input
            type="number"
            min={1}
            className="input w-24"
            placeholder="1"
            value={step}
            onChange={(e) => setStep(e.target.value)}
            aria-label="Default step amount"
          />
          <span className="font-mono text-[10px] text-parchment-800">{unit.trim() || "times"} per tap</span>
        </div>
        <p className="font-mono text-[9px] text-parchment-800 mt-1 tracking-wide">
          how much the + button adds by default (you can still log any amount)
        </p>
      </div>

      <div className="relative">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as GoalPeriod)}
          className="input appearance-none pr-8 cursor-pointer w-full"
          aria-label="Period"
        >
          <option value="week">Per week</option>
          <option value="month">Per month</option>
          <option value="ongoing">Ongoing</option>
        </select>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-parchment-700 pointer-events-none text-xs">▾</span>
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
        <button onClick={handleSubmit} disabled={!title.trim()} className="btn-primary flex-1">
          {initial ? "Save" : "Add goal"}
        </button>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export default function GoalsSection() {
  const { status } = useSession();
  const dataMode = useDataMode();
  const remote = dataMode === "remote";
  const [goals,   setGoals]   = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  // Goals completed & cleared earlier this week — remote reads the durable Completion log
  // (the heavy rows may already be gone); demo derives it from live goals.
  const [clearedWins, setClearedWins] = useState(0);

  const fetchGoals = useCallback(async () => {
    if (status === "loading") return;
    if (!remote) {
      setGoals(loadLocal().goals);
      setClearedWins(0); // demo goals aren't auto-cleared, so live goals already carry the credit
      setLoading(false);
      return;
    }
    const weekStart = startOfWeek(new Date()).toISOString();
    const [gRes, cRes] = await Promise.all([
      fetch("/api/goals"),
      fetch(`/api/completions?kind=goal&since=${encodeURIComponent(weekStart)}`),
    ]);
    if (gRes.ok) setGoals(await gRes.json());
    if (cRes.ok) setClearedWins((await cRes.json()).completedThisWeek ?? 0);
    setLoading(false);
  }, [remote, status]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  // Clamp + completion mirror the server rule so optimistic UI matches the DB.
  const applyLocal = (goal: Goal, patch: Partial<Goal>): Goal => {
    const merged = { ...goal, ...patch };
    const target = merged.target;
    const current = Math.min(Math.max(merged.current, 0), target);
    const completed = current >= target;
    // Stamp completedAt on the transition (mirrors the server) so momentum credits the win.
    const completedAt = completed
      ? (goal.completed ? goal.completedAt ?? new Date().toISOString() : new Date().toISOString())
      : null;
    return { ...merged, current, completed, completedAt };
  };

  const handleStep = async (goal: Goal, delta: number) => {
    const wasComplete = goal.completed || goal.current >= goal.target;
    const next = applyLocal(goal, { current: goal.current + delta });
    const nowComplete = next.completed;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? next : g)));
    if (!remote) {
      updateLocal((state) => ({ ...state, goals: state.goals.map((g) => (g.id === goal.id ? next : g)) }));
      return;
    }
    // Keep the weekly momentum count in sync with the completion the server just recorded,
    // without refetching — otherwise the bar drops toward 0% the instant a goal is finished.
    if (nowComplete && !wasComplete) setClearedWins((w) => w + 1);
    else if (!nowComplete && wasComplete) setClearedWins((w) => Math.max(0, w - 1));
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: next.current }),
    });
    if (res.ok) { const updated: Goal = await res.json(); setGoals((prev) => prev.map((g) => (g.id === goal.id ? updated : g))); }
  };

  const handleCreate = async (draft: GoalDraft) => {
    if (!remote) {
      const now = new Date().toISOString();
      const goal: Goal = {
        id: `demo-goal-${Date.now()}`,
        title: draft.title,
        unit: draft.unit,
        target: draft.target,
        current: 0,
        step: draft.step,
        period: draft.period,
        startDate: now,
        completed: false,
        completedAt: null,
        source: "manual",
        createdAt: now,
        updatedAt: now,
      };
      setGoals((prev) => [goal, ...prev]);
      updateLocal((state) => ({ ...state, goals: [goal, ...state.goals] }));
      setShowAdd(false);
      return;
    }
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft.title, unit: draft.unit, target: draft.target, step: draft.step, period: draft.period }),
    });
    if (res.ok) { const goal: Goal = await res.json(); setGoals((prev) => [goal, ...prev]); setShowAdd(false); }
  };

  const handleEditSave = async (draft: GoalDraft) => {
    if (!editing) return;
    const next = applyLocal(editing, { title: draft.title, unit: draft.unit, target: draft.target, step: draft.step, period: draft.period });
    setGoals((prev) => prev.map((g) => (g.id === editing.id ? next : g)));
    const id = editing.id;
    setEditing(null);
    if (!remote) {
      updateLocal((state) => ({ ...state, goals: state.goals.map((g) => (g.id === id ? next : g)) }));
      return;
    }
    const res = await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft.title, unit: draft.unit, target: draft.target, step: draft.step, period: draft.period }),
    });
    if (res.ok) { const updated: Goal = await res.json(); setGoals((prev) => prev.map((g) => (g.id === id ? updated : g))); }
  };

  const handleDelete = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (!remote) {
      updateLocal((state) => ({ ...state, goals: state.goals.filter((g) => g.id !== id) }));
      return;
    }
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
  };

  // Shared-modal save: keep it a goal (update fields) or convert it to a task/reminder.
  const handleGoalModalSave = async (item: NewItem, editId?: string) => {
    if (!editId || !editing) return;
    if (item.type === "goal") {
      await handleEditSave({
        title: item.title, unit: item.unit, target: item.target, step: item.step,
        period: item.period, current: editing.current,
      });
      return; // handleEditSave clears `editing`
    }
    // Convert goal → task/reminder: drop it from the goals list; it re-homes to its destination view.
    const id = editing.id;
    setEditing(null);
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (!remote) convertItemDemo("goal", id, item);
    else await convertItemRemote("goal", id, item);
  };

  if (loading) return null;

  // ── Weekly momentum ────────────────────────────────────────────────────────
  // The bar reflects THIS WEEK's momentum, not a cold average: progress on live goals
  // PLUS goals already completed & cleared this week (each counts as a full pseudo-goal).
  // So finishing a goal keeps the bar up all week instead of resetting it toward a
  // demoralizing 0% once the row is auto-deleted.
  const active = goals.filter((g) => !(g.completed || g.current >= g.target));
  const wins = remote ? clearedWins : goalsDoneThisWeek(goals); // completions this week (cleared or still shown)
  const activeCurrent = active.reduce((s, g) => s + Math.min(g.current, g.target), 0);
  const activeTarget  = active.reduce((s, g) => s + g.target, 0);
  const avgTarget = active.length
    ? activeTarget / active.length
    : (goals.length ? goals.reduce((s, g) => s + g.target, 0) / goals.length : 1);
  const winCredit = wins * avgTarget; // each completed win = one fully-filled pseudo-goal
  const denom = activeTarget + winCredit;
  const momentumPct = denom === 0 ? 0 : Math.round(Math.min(100, ((activeCurrent + winCredit) / denom) * 100));
  const showOverview = goals.length > 0 || wins > 0;
  const allClear = active.length === 0 && wins > 0; // finished everything this week

  const byPeriod: Record<GoalPeriod, number> = { week: 0, month: 0, ongoing: 0 };
  for (const g of active) byPeriod[g.period] = (byPeriod[g.period] ?? 0) + 1;
  const PERIOD_SHORT: Record<GoalPeriod, string> = { week: "weekly", month: "monthly", ongoing: "ongoing" };

  return (
    <div className="space-y-3">
      {/* Weekly momentum overview */}
      {showOverview && (
        <div className="bg-ink-900 border border-ink-700 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-parchment-700">
              {allClear
                ? "all clear this week"
                : `this week's momentum${wins > 0 ? ` · ${wins} done` : ""}`}
            </span>
            <span className="font-display italic text-base text-accent leading-none">{momentumPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${allClear ? "bg-priority-low" : "bg-accent"}`}
              style={{ width: `${momentumPct}%` }}
            />
          </div>
          {allClear ? (
            <p className="font-mono text-[9px] text-parchment-700 pt-0.5">
              nicely done — {wins} {wins === 1 ? "goal" : "goals"} completed. add another whenever you’re ready.
            </p>
          ) : (
            <div className="flex items-center gap-4 pt-0.5">
              {(["week", "month", "ongoing"] as GoalPeriod[]).map((p) =>
                byPeriod[p] > 0 ? (
                  <span key={p} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-parchment-700" />
                    <span className="font-mono text-[9px] text-parchment-700">
                      {byPeriod[p]} {PERIOD_SHORT[p]}
                    </span>
                  </span>
                ) : null
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="label">{goals.length} tracked</p>
        <button
          onClick={() => { setShowAdd((s) => !s); setEditing(null); }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-accent/30
                     hover:border-accent/60 font-mono text-[10px] uppercase tracking-wider
                     text-accent/80 hover:text-accent transition-all focus:outline-none"
        >
          {showAdd ? "× close" : "+ goal"}
        </button>
      </div>

      {showAdd && !editing && (
        <GoalForm onSubmit={handleCreate} onCancel={() => setShowAdd(false)} />
      )}

      {goals.length === 0 && !showAdd ? (
        <EmptyState
          className="py-6"
          line="no goals yet."
          sub={'add one, or say “gym every day this week” in a journal entry.'}
        />
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onStep={handleStep}
              onEdit={(g) => { setEditing(g); setShowAdd(false); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Edit / convert via the shared modal — the type toggle lets a goal become a task or reminder */}
      {editing && (
        <ItemEditModal
          defaultDate={new Date()}
          editItem={{ kind: "goal", data: editing }}
          onSave={handleGoalModalSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
