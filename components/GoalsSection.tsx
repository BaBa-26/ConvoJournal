"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { Goal, GoalPeriod } from "@/types";
import { loadDemoState, updateDemoState } from "@/lib/demoData";

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

      {/* Steppers */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-parchment-800">
          {done ? "complete" : `${pct}%`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStep(goal, -1)}
            disabled={goal.current <= 0}
            aria-label="Decrease progress"
            className="w-8 h-8 rounded-lg border border-ink-700 text-parchment-500
                       hover:border-parchment-700/60 hover:text-parchment-300 transition-all
                       disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none
                       flex items-center justify-center text-base leading-none"
          >
            −
          </button>
          <button
            onClick={() => onStep(goal, 1)}
            disabled={goal.current >= goal.target}
            aria-label="Increase progress"
            className="w-8 h-8 rounded-lg border border-accent/40 text-accent
                       hover:bg-accent/10 transition-all
                       disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none
                       flex items-center justify-center text-base leading-none"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add / edit form ──────────────────────────────────────────────────────────

interface GoalDraft {
  title: string;
  target: number;
  unit: string;
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
  const [period, setPeriod] = useState<GoalPeriod>(initial?.period ?? "week");

  const handleSubmit = () => {
    const t = parseInt(target, 10);
    if (!title.trim() || isNaN(t) || t < 1) return;
    onSubmit({ title: title.trim(), target: t, unit: unit.trim() || "times", period, current: initial?.current });
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
  const { data: session, status } = useSession();
  const [goals,   setGoals]   = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const fetchGoals = useCallback(async () => {
    if (status === "loading") return;
    if (!session) {
      setGoals(loadDemoState().goals);
      setLoading(false);
      return;
    }
    const res = await fetch("/api/goals");
    if (res.ok) setGoals(await res.json());
    setLoading(false);
  }, [session, status]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  // Clamp + completion mirror the server rule so optimistic UI matches the DB.
  const applyLocal = (goal: Goal, patch: Partial<Goal>): Goal => {
    const merged = { ...goal, ...patch };
    const target = merged.target;
    const current = Math.min(Math.max(merged.current, 0), target);
    return { ...merged, current, completed: current >= target };
  };

  const handleStep = async (goal: Goal, delta: number) => {
    const next = applyLocal(goal, { current: goal.current + delta });
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? next : g)));
    if (!session) {
      updateDemoState((state) => ({ ...state, goals: state.goals.map((g) => (g.id === goal.id ? next : g)) }));
      return;
    }
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: next.current }),
    });
    if (res.ok) { const updated: Goal = await res.json(); setGoals((prev) => prev.map((g) => (g.id === goal.id ? updated : g))); }
  };

  const handleCreate = async (draft: GoalDraft) => {
    if (!session) {
      const now = new Date().toISOString();
      const goal: Goal = {
        id: `demo-goal-${Date.now()}`,
        title: draft.title,
        unit: draft.unit,
        target: draft.target,
        current: 0,
        period: draft.period,
        startDate: now,
        completed: false,
        source: "manual",
        createdAt: now,
        updatedAt: now,
      };
      setGoals((prev) => [goal, ...prev]);
      updateDemoState((state) => ({ ...state, goals: [goal, ...state.goals] }));
      setShowAdd(false);
      return;
    }
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft.title, unit: draft.unit, target: draft.target, period: draft.period }),
    });
    if (res.ok) { const goal: Goal = await res.json(); setGoals((prev) => [goal, ...prev]); setShowAdd(false); }
  };

  const handleEditSave = async (draft: GoalDraft) => {
    if (!editing) return;
    const next = applyLocal(editing, { title: draft.title, unit: draft.unit, target: draft.target, period: draft.period });
    setGoals((prev) => prev.map((g) => (g.id === editing.id ? next : g)));
    const id = editing.id;
    setEditing(null);
    if (!session) {
      updateDemoState((state) => ({ ...state, goals: state.goals.map((g) => (g.id === id ? next : g)) }));
      return;
    }
    const res = await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft.title, unit: draft.unit, target: draft.target, period: draft.period }),
    });
    if (res.ok) { const updated: Goal = await res.json(); setGoals((prev) => prev.map((g) => (g.id === id ? updated : g))); }
  };

  const handleDelete = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (!session) {
      updateDemoState((state) => ({ ...state, goals: state.goals.filter((g) => g.id !== id) }));
      return;
    }
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
  };

  if (loading) return null;

  // Aggregate progress across all goals — the headline bar mirrors the Tasks tab overview.
  const doneCount = goals.filter((g) => g.completed || g.current >= g.target).length;
  const avgPct = goals.length === 0 ? 0 : Math.round(
    goals.reduce((sum, g) => sum + (g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0), 0) / goals.length
  );
  const byPeriod: Record<GoalPeriod, number> = { week: 0, month: 0, ongoing: 0 };
  for (const g of goals) byPeriod[g.period] = (byPeriod[g.period] ?? 0) + 1;
  const PERIOD_SHORT: Record<GoalPeriod, string> = { week: "weekly", month: "monthly", ongoing: "ongoing" };

  return (
    <div className="space-y-3">
      {/* Overall goal progress overview */}
      {goals.length > 0 && (
        <div className="bg-ink-900 border border-ink-700 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-parchment-700">
              {doneCount} of {goals.length} complete
            </span>
            <span className="font-display italic text-base text-accent leading-none">{avgPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${avgPct}%` }}
            />
          </div>
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
        <p className="font-mono text-xs text-parchment-800 py-2">
          no goals yet — add one, or say “gym every day this week” in a journal entry
        </p>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) =>
            editing?.id === goal.id ? (
              <GoalForm
                key={goal.id}
                initial={goal}
                onSubmit={handleEditSave}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <GoalCard
                key={goal.id}
                goal={goal}
                onStep={handleStep}
                onEdit={(g) => { setEditing(g); setShowAdd(false); }}
                onDelete={handleDelete}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
