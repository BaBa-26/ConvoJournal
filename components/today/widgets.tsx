"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format, parseISO, isToday, startOfDay, differenceInCalendarDays } from "date-fns";
import type { AgendaItem, WeekStats, StreakDay, JournalEntry, Task, Reminder, Goal, GoalPeriod } from "@/types";
import { computeTaskStats } from "@/lib/taskStats";
import { loadDemoState } from "@/lib/demoData";

const PRIORITY_COLORS: Record<string, string> = {
  high: "#c87a6a",
  medium: "#c8a860",
  low: "#7a9a7a",
};

const LABEL = "text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground";

// ─── Agenda ───────────────────────────────────────────────────────────────────

export function AgendaList({
  items,
  title = "Your day, in order",
  emptyText = "A clear day. Start fresh.",
}: {
  items: AgendaItem[];
  title?: string;
  emptyText?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-1.5">
      <p className={`${LABEL} px-3 pt-2.5 pb-1.5`}>{title}</p>
      {items.length === 0 ? (
        <p className="font-display italic text-base text-muted-foreground text-center py-5">{emptyText}</p>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="flex items-start gap-3 px-3 py-2.5">
              {item.kind === "reminder" ? (
                <span className="font-mono text-[10px] text-accent flex-shrink-0 mt-0.5 w-14">
                  {format(parseISO(item.date), "h:mm a")}
                </span>
              ) : (
                <span
                  className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: PRIORITY_COLORS[item.priority ?? "medium"] }}
                />
              )}
              {item.kind === "reminder" && (
                <span className="mt-1 w-2.5 h-2.5 rounded-full border-2 border-accent flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-foreground">{item.title}</p>
                {item.kind === "task" && item.overdue && (
                  <span className="inline-block mt-1 font-mono text-[9px] uppercase tracking-wider text-priority-high">
                    overdue
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Streak heatmap ─────────────────────────────────────────────────────────────

const HEAT_FILL: Record<number, string> = {
  0: "color-mix(in oklab, rgb(var(--accent)) 9%, transparent)",
  1: "color-mix(in oklab, rgb(var(--accent)) 26%, transparent)",
  2: "color-mix(in oklab, rgb(var(--accent)) 46%, transparent)",
  3: "color-mix(in oklab, rgb(var(--accent)) 70%, transparent)",
  4: "rgb(var(--accent))",
};

export function StreakHeatmap({
  days,
  streakCount,
  label = "Writing streak",
  caption,
  footer,
}: {
  days: StreakDay[];
  streakCount: number;
  label?: string;
  caption?: string;
  footer?: React.ReactNode;
}) {
  // Caption reflects the real streak (not a hard-coded line) unless a footer/caption is passed in.
  const entryDays = days.filter((d) => d.hasEntry).length;
  const autoCaption =
    streakCount <= 0
      ? entryDays > 0
        ? "Streak broken — write today to start a new one."
        : "No entries yet. Speak once to begin your streak."
      : streakCount === 1
        ? "1 day in. Don't break the chain."
        : `${streakCount} days running. Don't break the chain.`;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex justify-between items-center">
        <span className={LABEL}>{label}</span>
        <span className="font-display italic font-semibold text-lg text-accent">
          {streakCount} {streakCount === 1 ? "day" : "days"}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 my-3.5">
        {days.map((d) => (
          <span
            key={d.date}
            className="w-full rounded-[3px]"
            style={{ aspectRatio: "1 / 1", background: HEAT_FILL[d.level] }}
            title={d.date}
          />
        ))}
      </div>
      {footer ?? <p className="font-mono text-[11px] text-muted-foreground m-0">{caption ?? autoCaption}</p>}
    </div>
  );
}

// ─── Weekly stats ───────────────────────────────────────────────────────────────

export function WeeklyStats({
  stats,
  inline = false,
  label = "This week",
}: {
  stats: WeekStats;
  inline?: boolean;
  label?: string;
}) {
  const row = (
    <div className="grid grid-cols-3 gap-2.5">
      {[
        { num: stats.entries, lbl: "Entries" },
        { num: stats.done, lbl: "Done" },
        { num: stats.pending, lbl: "Pending" },
      ].map((s) => (
        <div key={s.lbl} className="py-3 px-2 text-center rounded-2xl bg-muted border border-border">
          <div className="font-display italic font-semibold text-2xl text-foreground leading-none">{s.num}</div>
          <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground mt-1.5">{s.lbl}</div>
        </div>
      ))}
    </div>
  );

  if (inline) return row;

  return (
    <div>
      <p className={`${LABEL} mb-2.5 ml-0.5`}>{label}</p>
      {row}
    </div>
  );
}

// ─── Task tracker ───────────────────────────────────────────────────────────────

// Task completion progress, derived from the tasks already loaded for Today. Mirrors the
// overview card on the Tasks screen so the number matches. Taps through to the full list.
export function TaskTracker({
  tasks,
  label = "Task progress",
}: {
  tasks: Task[];
  label?: string;
}) {
  const stats = computeTaskStats(tasks);

  return (
    <Link href="/tasks" className="block bg-card border border-border rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className={LABEL}>{label}</span>
        {stats.total > 0
          ? <span className="font-display italic font-semibold text-lg text-accent leading-none">{stats.completionPct}%</span>
          : <span className="font-mono text-[10px] text-muted-foreground">none yet</span>}
      </div>

      {stats.total > 0 ? (
        <>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${stats.completionPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-0.5">
            <span className="font-mono text-[10px] text-muted-foreground">
              {stats.done} of {stats.total} done
            </span>
            <div className="flex items-center gap-3">
              {(["high", "medium", "low"] as const).map((p) => (
                <span key={p} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_COLORS[p] }} />
                  <span className="font-mono text-[9px] text-muted-foreground">{stats.byPriority[p]}</span>
                </span>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="font-display italic text-sm text-muted-foreground">
          No tasks yet — they appear here as you add them.
        </p>
      )}
    </Link>
  );
}

// ─── Goals tracker ──────────────────────────────────────────────────────────────

const GOAL_PERIOD_LABEL: Record<GoalPeriod, string> = {
  week: "this week", month: "this month", ongoing: "ongoing",
};

// Compact, read-only view of tracked goals with progress bars. Fetches its own goals
// (session-aware, with a demo fallback) since Today's data hook doesn't carry them.
// Taps through to the Goals screen for stepping/editing.
export function GoalsTracker({ label = "Goals" }: { label?: string }) {
  const { data: session, status } = useSession();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (status === "loading") return;
    if (!session) {
      setGoals(loadDemoState().goals);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/goals");
      if (res.ok) setGoals(await res.json());
    } catch { /* leave empty on failure */ }
    setLoading(false);
  }, [session, status]);

  useEffect(() => { load(); }, [load]);

  if (loading) return null;

  return (
    <Link href="/tasks" className="block bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className={LABEL}>{label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{goals.length} tracked</span>
      </div>

      {goals.length === 0 ? (
        <p className="font-display italic text-sm text-muted-foreground">
          No goals yet — set one on the Goals screen.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {goals.slice(0, 4).map((g) => {
            const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
            const done = g.completed || g.current >= g.target;
            return (
              <div key={g.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-foreground truncate">{g.title}</span>
                  <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
                    <span className="text-accent">{g.current}</span>/{g.target} {g.unit}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: done ? PRIORITY_COLORS.low : "rgb(var(--accent))" }}
                  />
                </div>
              </div>
            );
          })}
          {goals.length > 4 && (
            <span className="font-mono text-[10px] text-muted-foreground">+{goals.length - 4} more →</span>
          )}
        </div>
      )}
    </Link>
  );
}

// ─── Tonight CTA ────────────────────────────────────────────────────────────────

export function TonightCTA({
  kicker = "Tonight",
  prompt = "How did the day actually feel?",
  cta = "Write tonight's reflection",
  reminderLabel,
  reminderPrefix = "reminder set",
}: {
  kicker?: string;
  prompt?: string;
  cta?: string;
  reminderLabel?: string | null;
  reminderPrefix?: string;
}) {
  return (
    <div className="bg-muted border border-border rounded-2xl p-5">
      <p className="font-mono text-[9px] text-accent uppercase tracking-[0.18em]">{kicker}</p>
      <p className="font-display italic text-lg text-foreground mt-2 leading-snug">{prompt}</p>
      <Link href="/journal" className="btn-primary justify-center mt-4 w-full">
        {cta}
      </Link>
      {reminderLabel && (
        <p className={`${LABEL} mt-3 text-center`}>
          {reminderPrefix} · {reminderLabel}
        </p>
      )}
    </div>
  );
}

// ─── Tomorrow preview ───────────────────────────────────────────────────────────

export function TomorrowPreview({
  tasks,
  reminders,
  label = "Tomorrow",
}: {
  tasks: Task[];
  reminders: Reminder[];
  label?: string;
}) {
  const today = startOfDay(new Date());
  const isTomorrow = (iso: string) => differenceInCalendarDays(startOfDay(parseISO(iso)), today) === 1;

  const items = [
    ...reminders.filter((r) => isTomorrow(r.eventDate)).map((r) => ({ id: r.id, date: r.eventDate, title: r.title })),
    ...tasks
      .filter((t) => !t.completed && t.dueDate && isTomorrow(t.dueDate))
      .map((t) => ({ id: t.id, date: t.dueDate!, title: t.title })),
  ].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

  if (items.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className={`${LABEL} mb-2.5`}>{label}</p>
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-accent w-14 flex-shrink-0">
              {format(parseISO(it.date), "h:mm a")}
            </span>
            <span className="font-mono text-sm text-foreground">{it.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent reflections ─────────────────────────────────────────────────────────

export function RecentReflections({
  entries,
  label = "Recent reflections",
}: {
  entries: JournalEntry[];
  label?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl px-4 pb-4 pt-1">
      <p className={`${LABEL} mt-3 mb-0.5`}>{label}</p>
      {entries.map((e) => {
        const snippet = (e.today || e.rawContent || "").trim();
        const when = isToday(parseISO(e.date)) ? "TODAY" : format(parseISO(e.date), "EEE").toUpperCase();
        return (
          <div key={e.id} className="py-2.5 border-t border-border first:border-t-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={LABEL}>{when}</span>
              {e.mood && (
                <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-accent border border-accent rounded-full px-2 py-0.5">
                  {e.mood}
                </span>
              )}
            </div>
            <p className="font-display italic text-foreground/85 text-sm m-0 leading-snug line-clamp-2">{snippet}</p>
          </div>
        );
      })}
    </div>
  );
}
