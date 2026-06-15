"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format, isToday, isTomorrow, isPast, differenceInDays, differenceInHours,
} from "date-fns";
import { useSession, signIn } from "next-auth/react";
import type { Reminder } from "@/types";
import { loadDemoState, updateDemoState } from "@/lib/demoData";

// ─── Reminder card ────────────────────────────────────────────────────────────

function ReminderCard({ reminder }: { reminder: Reminder }) {
  const date = new Date(reminder.eventDate);
  const today    = isToday(date);
  const tomorrow = isTomorrow(date);
  const past     = isPast(date) && !today;
  const daysOut  = differenceInDays(date, new Date());
  const hoursOut = differenceInHours(date, new Date());

  // Proximity label
  const proximityLabel = today    ? "Today"
    : tomorrow                    ? "Tomorrow"
    : daysOut > 0                 ? `In ${daysOut}d`
    : hoursOut > 0                ? `In ${hoursOut}h`
    : format(date, "MMM d");

  // Upcoming with green tint; today/tomorrow with warm tint
  const borderColor = past   ? "border-ink-700/50"
    : today || tomorrow      ? "border-amber-800/60"
    : /* upcoming */           "border-green-900/50";

  const bgColor = past   ? "bg-ink-900/30"
    : today || tomorrow  ? "bg-amber-950/20"
    : /* upcoming */       "bg-green-950/20";

  const dotColor = past   ? "bg-parchment-700"
    : today              ? "bg-gold"
    : tomorrow           ? "bg-amber-500/80"
    :                      "bg-green-600/80";

  return (
    <div className={`rounded-xl border px-4 py-3.5 ${borderColor} ${bgColor} ${past ? "opacity-45" : ""}`}>
      <div className="flex items-start gap-3">
        {/* Dot + proximity */}
        <div className="flex flex-col items-center gap-1.5 pt-0.5 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className={`font-mono text-[8px] uppercase tracking-widest whitespace-nowrap
            ${today ? "text-gold" : tomorrow ? "text-amber-500/80" : past ? "text-parchment-700" : "text-green-600/80"}`}>
            {proximityLabel}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-parchment-300 leading-5">{reminder.title}</p>
          {reminder.description && (
            <p className="font-mono text-xs text-parchment-700 mt-1 leading-5">{reminder.description}</p>
          )}
          <p className="font-mono text-[10px] text-parchment-700 mt-2">
            {format(date, "EEEE, MMM d · h:mm a")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Add reminder form ────────────────────────────────────────────────────────

function AddReminderForm({ onAdd, onCancel }: { onAdd: (r: Partial<Reminder>) => void; onCancel: () => void }) {
  const [title, setTitle]   = useState("");
  const [date, setDate]     = useState("");
  const [desc, setDesc]     = useState("");

  const handleSubmit = () => {
    if (!title.trim() || !date) return;
    onAdd({ title: title.trim(), eventDate: new Date(date).toISOString(), description: desc || undefined });
  };

  return (
    <div className="card space-y-3 animate-slide-up">
      <p className="label">New Reminder</p>

      <input
        className="input"
        placeholder="What's the event?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <textarea
        className="textarea"
        placeholder="Notes (optional)"
        rows={2}
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />

      <input
        type="datetime-local"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="input"
      />

      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
        <button onClick={handleSubmit} disabled={!title.trim() || !date} className="btn-primary flex-1">
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RemindersScreen() {
  const { data: session, status } = useSession();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);

  const fetchReminders = useCallback(async () => {
    if (status === "loading") return;
    if (!session) {
      setReminders(loadDemoState().reminders);
      setLoading(false);
      return;
    }
    const res = await fetch("/api/reminders");
    if (res.ok) setReminders(await res.json());
    setLoading(false);
  }, [session, status]);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const handleAdd = async (data: Partial<Reminder>) => {
    if (!session) {
      const reminder: Reminder = {
        id: `demo-reminder-${Date.now()}`,
        title: data.title ?? "Untitled reminder",
        description: data.description ?? null,
        eventDate: data.eventDate ?? new Date().toISOString(),
        reminded: false,
        journalEntryId: null,
        createdAt: new Date().toISOString(),
      };
      setReminders((prev) =>
        [...prev, reminder].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
      );
      updateDemoState((state) => ({ ...state, reminders: [...state.reminders, reminder] }));
      setShowAdd(false);
      return;
    }
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const reminder: Reminder = await res.json();
      setReminders((prev) =>
        [...prev, reminder].sort(
          (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
        )
      );
      setShowAdd(false);
    }
  };

  const upcoming = reminders.filter((r) => !isPast(new Date(r.eventDate)) || isToday(new Date(r.eventDate)));
  const past     = reminders.filter((r) => isPast(new Date(r.eventDate)) && !isToday(new Date(r.eventDate)));

  // ── Auth gate ──────────────────────────────────────────
  if (false && status !== "loading" && !session) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8">
        <div className="text-center space-y-2">
          <p className="font-mono text-3xl text-parchment-800">◎</p>
          <h2 className="font-display text-xl text-parchment-300">Sign in to view your reminders</h2>
          <p className="font-mono text-xs text-parchment-700 leading-6">
            Your journal data is private and<br />tied to your account.
          </p>
        </div>
        <button onClick={() => signIn()} className="btn-primary px-8">Sign in</button>
        <p className="font-mono text-[9px] text-parchment-800 tracking-widest uppercase">
          Voice recording still works without signing in
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <header className="px-5 pt-safe pt-5 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl text-parchment-200">Reminders</h1>
            <p className="font-mono text-[10px] text-parchment-700 mt-1 tracking-widest uppercase">
              {upcoming.length} upcoming
            </p>
          </div>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="w-11 h-11 rounded-full border border-gold/40 flex items-center justify-center
                       text-gold hover:bg-gold/10 transition-all active:scale-95 focus:outline-none"
            aria-label="Add reminder"
          >
            <span className="text-xl leading-none">{showAdd ? "×" : "+"}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-4">
        {showAdd && (
          <AddReminderForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
        )}

        {loading ? (
          <div className="text-center py-16">
            <p className="font-mono text-xs text-parchment-700 tracking-widest">loading…</p>
          </div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="font-mono text-2xl text-parchment-800">◎</p>
            <p className="font-mono text-xs text-parchment-700 tracking-wide">no reminders yet</p>
            <p className="font-mono text-[10px] text-parchment-800">
              they&apos;ll appear here from your journal entries
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section className="space-y-2">
                <p className="label px-1">Upcoming</p>
                {upcoming.map((r) => <ReminderCard key={r.id} reminder={r} />)}
              </section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <section className="space-y-2">
                {/* Subtle divider between sections */}
                {upcoming.length > 0 && (
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 border-t border-ink-700" />
                    <span className="font-mono text-[9px] text-parchment-800 uppercase tracking-widest">past</span>
                    <div className="flex-1 border-t border-ink-700" />
                  </div>
                )}
                {!upcoming.length && <p className="label px-1">Past</p>}
                {past.map((r) => <ReminderCard key={r.id} reminder={r} />)}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
