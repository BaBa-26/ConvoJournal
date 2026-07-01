"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format, parseISO, isToday, isPast, subDays, startOfDay, differenceInCalendarDays } from "date-fns";
import type { Task, Reminder, JournalEntry, AgendaItem, WeekStats, StreakDay } from "@/types";
import { computeTaskStats } from "@/lib/taskStats";
import { loadDemoState } from "@/lib/demoData";

const DAY_KEY = "yyyy-MM-dd";

export interface TodayData {
  loading: boolean;
  tasks: Task[];
  reminders: Reminder[];
  entries: JournalEntry[];
  agendaItems: AgendaItem[];
  weekStats: WeekStats;
  streakDays: StreakDay[];
  streakCount: number;
  recentEntries: JournalEntry[];
  reload: () => void;
}

// Heatmap intensity (1–4) for a day that has an entry, bucketed by how much was
// written/captured that day. Gives the grid visual texture from real data.
function intensityLevel(entry: JournalEntry): 1 | 2 | 3 | 4 {
  const len = (entry.rawContent ?? "").length;
  const items = (entry.tasks?.length ?? 0) + (entry.reminders?.length ?? 0);
  const score = len / 90 + items; // ~1 per 90 chars, +1 per extracted item
  if (score >= 4) return 4;
  if (score >= 2.5) return 3;
  if (score >= 1.2) return 2;
  return 1;
}

export function useTodayData(): TodayData {
  const { data: session, status } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (status === "loading") return;
    setLoading(true);

    if (!session) {
      const demo = loadDemoState();
      setTasks(demo.tasks);
      setReminders(demo.reminders);
      setEntries(demo.entries);
      setLoading(false);
      return;
    }

    Promise.all([
      fetch("/api/tasks").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/reminders").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/journal?limit=40").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([t, r, e]) => {
      setTasks(Array.isArray(t) ? t : []);
      setReminders(Array.isArray(r) ? r : []);
      setEntries(Array.isArray(e) ? e : []);
      setLoading(false);
    });
  }, [session, status]);

  useEffect(() => { load(); }, [load]);

  const agendaItems = useMemo<AgendaItem[]>(() => {
    const todayReminders = reminders.filter((r) => isToday(parseISO(r.eventDate)));
    const dueTodayOrOverdue = tasks.filter(
      (t) => !t.completed && t.dueDate && (isToday(parseISO(t.dueDate)) || isPast(parseISO(t.dueDate)))
    );

    const items: AgendaItem[] = [
      ...todayReminders.map((r) => ({
        id: r.id,
        kind: "reminder" as const,
        date: r.eventDate,
        title: r.title,
      })),
      ...dueTodayOrOverdue.map((t) => {
        const due = parseISO(t.dueDate!);
        return {
          id: t.id,
          kind: "task" as const,
          date: t.dueDate!,
          title: t.title,
          priority: t.priority,
          overdue: isPast(due) && !isToday(due),
        };
      }),
    ];

    return items.sort((a, b) => {
      const delta = parseISO(a.date).getTime() - parseISO(b.date).getTime();
      if (delta !== 0) return delta;
      if (a.kind === b.kind) return 0;
      return a.kind === "reminder" ? -1 : 1;
    });
  }, [tasks, reminders]);

  // Map of yyyy-MM-dd → entry, used for both the streak count and the heatmap grid.
  const entryByDay = useMemo(() => {
    const m = new Map<string, JournalEntry>();
    for (const e of entries) {
      const key = format(parseISO(e.date), DAY_KEY);
      if (!m.has(key)) m.set(key, e);
    }
    return m;
  }, [entries]);

  const streakDays = useMemo<StreakDay[]>(() => {
    const today = startOfDay(new Date());
    const days: StreakDay[] = [];
    for (let i = 34; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, DAY_KEY);
      const entry = entryByDay.get(key);
      days.push({ date: key, hasEntry: !!entry, level: entry ? intensityLevel(entry) : 0 });
    }
    return days;
  }, [entryByDay]);

  const streakCount = useMemo(() => {
    const today = startOfDay(new Date());
    let cursor = entryByDay.has(format(today, DAY_KEY)) ? today : subDays(today, 1);
    let count = 0;
    while (entryByDay.has(format(cursor, DAY_KEY))) {
      count++;
      cursor = subDays(cursor, 1);
    }
    return count;
  }, [entryByDay]);

  const weekStats = useMemo<WeekStats>(() => {
    const today = startOfDay(new Date());
    const entriesThisWeek = entries.filter((e) => {
      const diff = differenceInCalendarDays(today, startOfDay(parseISO(e.date)));
      return diff >= 0 && diff < 7;
    }).length;
    const { done, pending } = computeTaskStats(tasks);
    return { entries: entriesThisWeek, done, pending };
  }, [entries, tasks]);

  const recentEntries = useMemo(
    () => [...entries].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()).slice(0, 3),
    [entries]
  );

  return {
    loading,
    tasks,
    reminders,
    entries,
    agendaItems,
    weekStats,
    streakDays,
    streakCount,
    recentEntries,
    reload: load,
  };
}
