"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { format, isToday, isPast, parseISO } from "date-fns";
import type { Task, Reminder } from "@/types";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "#c87a6a",
  medium: "#c8a860",
  low: "#7a9a7a",
};

export default function TodayScreen() {
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then(r => r.json()).catch(() => []),
      fetch("/api/reminders").then(r => r.json()).catch(() => []),
    ]).then(([t, r]) => {
      setTasks(Array.isArray(t) ? t : []);
      setReminders(Array.isArray(r) ? r : []);
      setLoading(false);
    });
  }, []);

  const dueTodayOrOverdue = tasks.filter(t =>
    !t.completed && t.dueDate &&
    (isToday(parseISO(t.dueDate)) || isPast(parseISO(t.dueDate)))
  );

  const todayReminders = reminders.filter(r => isToday(parseISO(r.eventDate)));

  const pendingCount = tasks.filter(t => !t.completed).length;

  const hasItems = dueTodayOrOverdue.length > 0 || todayReminders.length > 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden animate-fade-in">
      {/* Header */}
      <header className="px-5 pt-safe pt-5 pb-4 flex-shrink-0">
        <p className="font-mono text-[10px] text-parchment-700 uppercase tracking-[0.2em]">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
        <h1 className="font-display italic text-2xl text-parchment-100 leading-tight mt-1">
          {getGreeting()}.
        </h1>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-5">

        {/* Today's agenda */}
        <section>
          <p className="label mb-3">Your day, in order</p>
          {loading ? (
            <div className="card text-center py-6">
              <p className="font-mono text-xs text-parchment-800">Loading…</p>
            </div>
          ) : !hasItems ? (
            <div className="card py-6 text-center">
              <p className="font-display italic text-base text-parchment-600">
                A clear day. Start fresh.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {todayReminders.map(r => (
                <div
                  key={r.id}
                  className="flex items-start gap-3 bg-ink-900 border border-ink-700 rounded-xl px-4 py-3"
                >
                  <span className="font-mono text-[10px] text-gold flex-shrink-0 mt-0.5 w-14">
                    {format(parseISO(r.eventDate), "h:mm a")}
                  </span>
                  <p className="font-mono text-sm text-parchment-300">{r.title}</p>
                </div>
              ))}
              {dueTodayOrOverdue.map(t => (
                <div
                  key={t.id}
                  className="flex items-start gap-3 bg-ink-900 border border-ink-700 rounded-xl px-4 py-3"
                >
                  <span
                    className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.medium }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-parchment-200">{t.title}</p>
                    {t.dueDate && isPast(parseISO(t.dueDate)) && !isToday(parseISO(t.dueDate)) && (
                      <span className="inline-block font-mono text-[9px] uppercase tracking-wider text-priority-high mt-1">
                        overdue
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tonight's reflection CTA */}
        <div className="bg-ink-800 border border-ink-700 rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <p className="font-mono text-[9px] text-gold/70 uppercase tracking-[0.18em]">
              Tonight
            </p>
            <p className="font-display italic text-lg text-parchment-200 mt-2 leading-snug">
              How did the day actually feel?
            </p>
          </div>
          <Link href="/journal" className="btn-primary justify-center">
            Write tonight&apos;s reflection
          </Link>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/schedule"
            className="card-tight flex flex-col gap-1.5 hover:border-ink-600 transition-colors active:scale-[0.98]"
          >
            <p className="label">Calendar</p>
            <p className="font-display italic text-base text-parchment-300">Your week →</p>
          </Link>
          <Link
            href="/tasks"
            className="card-tight flex flex-col gap-1.5 hover:border-ink-600 transition-colors active:scale-[0.98]"
          >
            <p className="label">Goals</p>
            {loading ? (
              <p className="font-display italic text-base text-parchment-600">—</p>
            ) : (
              <p className="font-display italic text-base text-parchment-300">
                {pendingCount} pending →
              </p>
            )}
          </Link>
        </div>

      </div>
    </div>
  );
}
