"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format, isToday, isTomorrow, isPast, differenceInDays, differenceInHours,
} from "date-fns";
import { useSession, signIn } from "next-auth/react";
import type { Reminder } from "@/types";
import { loadLocal, updateLocal } from "@/lib/localStore";
import { useDataMode } from "@/components/PreferencesProvider";
import ItemEditModal, { type NewItem } from "@/components/ItemEditModal";

// ─── Reminder card ────────────────────────────────────────────────────────────

function ReminderCard({
  reminder, onEdit, onDelete,
}: {
  reminder: Reminder;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: string) => void;
}) {
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

        {/* Edit + Delete */}
        <div className="flex-shrink-0 flex items-center gap-0.5">
          <button
            onClick={() => onEdit(reminder)}
            className="p-1.5 rounded-lg text-parchment-700 hover:text-parchment-300
                       transition-colors focus:outline-none min-w-[36px] min-h-[36px]
                       flex items-center justify-center"
            aria-label="Edit reminder"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(reminder.id)}
            className="p-1.5 -mr-1 rounded-lg text-parchment-700 hover:text-priority-high
                       transition-colors focus:outline-none min-w-[36px] min-h-[36px]
                       flex items-center justify-center"
            aria-label="Delete reminder"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
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
  const dataMode = useDataMode();
  const remote = dataMode === "remote";
  const [reminders, setReminders]     = useState<Reminder[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showAdd, setShowAdd]         = useState(false);
  const [editReminder, setEditReminder] = useState<Reminder | null>(null);

  const fetchReminders = useCallback(async () => {
    if (status === "loading") return;
    if (!remote) {
      setReminders(loadLocal().reminders);
      setLoading(false);
      return;
    }
    const res = await fetch("/api/reminders");
    if (res.ok) setReminders(await res.json());
    setLoading(false);
  }, [remote, status]);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const handleAdd = async (data: Partial<Reminder>) => {
    if (!remote) {
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
      updateLocal((state) => ({ ...state, reminders: [...state.reminders, reminder] }));
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

  // Edit an existing reminder via the shared modal.
  const handleUpdate = async (item: NewItem, editId?: string) => {
    if (!editId) return;
    const eventDate = new Date(item.date + "T" + item.time + ":00").toISOString();
    const apply = (r: Reminder): Reminder => ({
      ...r, title: item.title, eventDate, description: item.description || null,
    });
    const resort = (list: Reminder[]) =>
      [...list].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    if (!remote) {
      setReminders((prev) => resort(prev.map((r) => (r.id === editId ? apply(r) : r))));
      updateLocal((state) => ({
        ...state,
        reminders: state.reminders.map((r) => (r.id === editId ? apply(r) : r)),
      }));
      return;
    }
    setReminders((prev) => resort(prev.map((r) => (r.id === editId ? apply(r) : r)))); // optimistic
    const res = await fetch(`/api/reminders/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: item.title, eventDate, description: item.description || null }),
    });
    if (res.ok) {
      const updated: Reminder = await res.json();
      setReminders((prev) => resort(prev.map((r) => (r.id === editId ? updated : r))));
    }
  };

  const handleDelete = async (id: string) => {
    if (!remote) {
      setReminders((prev) => prev.filter((r) => r.id !== id));
      updateLocal((state) => ({ ...state, reminders: state.reminders.filter((r) => r.id !== id) }));
      return;
    }
    setReminders((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
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
   <>
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
            className="mr-12 md:mr-0 w-11 h-11 rounded-full border border-gold/40 flex items-center justify-center
                       text-gold hover:bg-gold/10 transition-all active:scale-95 focus:outline-none"
            aria-label="Add reminder"
          >
            <span className="text-xl leading-none">{showAdd ? "×" : "+"}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-nav">
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
                {upcoming.map((r) => (
                  <ReminderCard key={r.id} reminder={r} onEdit={setEditReminder} onDelete={handleDelete} />
                ))}
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
                {past.map((r) => (
                  <ReminderCard key={r.id} reminder={r} onEdit={setEditReminder} onDelete={handleDelete} />
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>

    {editReminder && (
      <ItemEditModal
        defaultDate={new Date()}
        lockType="reminder"
        editItem={{ kind: "reminder", data: editReminder }}
        onSave={handleUpdate}
        onClose={() => setEditReminder(null)}
      />
    )}
   </>
  );
}
