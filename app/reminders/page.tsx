"use client";

import { useState, useEffect, useCallback } from "react";
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
import { Bell, Plus, Calendar } from "lucide-react";
import Navigation from "@/components/Navigation";
import type { Reminder } from "@/types";

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders");
      if (res.ok) setReminders(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const handleAdd = async () => {
    if (!newTitle.trim() || !newDate) return;
    setAdding(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDesc || null, eventDate: newDate }),
      });
      if (res.ok) {
        const reminder: Reminder = await res.json();
        setReminders((prev) => [...prev, reminder].sort(
          (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
        ));
        setNewTitle("");
        setNewDate("");
        setNewDesc("");
        setShowAdd(false);
      }
    } finally {
      setAdding(false);
    }
  };

  const upcoming = reminders.filter((r) => !isPast(new Date(r.eventDate)) || isToday(new Date(r.eventDate)));
  const past = reminders.filter((r) => isPast(new Date(r.eventDate)) && !isToday(new Date(r.eventDate)));

  return (
    <div className="flex flex-col flex-1">
      <header className="px-4 pt-6 pb-4 bg-white border-b border-stone-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Reminders</h1>
            <p className="text-xs text-stone-400 mt-0.5">{upcoming.length} upcoming</p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="w-9 h-9 rounded-full bg-journal-500 flex items-center justify-center shadow-md"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Add form */}
        {showAdd && (
          <div className="card space-y-3 animate-fade-in">
            <p className="section-label">New Reminder</p>
            <input
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-journal-400"
              placeholder="Reminder title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm resize-none h-16
                         focus:outline-none focus:ring-2 focus:ring-journal-400"
              placeholder="Notes (optional)..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <input
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-journal-400"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAdd} disabled={!newTitle.trim() || !newDate || adding} className="btn-primary flex-1">
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-stone-400 text-sm">Loading...</div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-8 h-8 text-stone-200 mx-auto mb-2" />
            <p className="text-stone-400 text-sm">No reminders yet</p>
            <p className="text-stone-300 text-xs mt-1">They&apos;ll appear here from your journal entries</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="space-y-2">
                <p className="section-label px-1">Upcoming</p>
                {upcoming.map((r) => (
                  <ReminderCard key={r.id} reminder={r} />
                ))}
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-2">
                <p className="section-label px-1 mt-4">Past</p>
                {past.map((r) => (
                  <ReminderCard key={r.id} reminder={r} faded />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Navigation />
    </div>
  );
}

function ReminderCard({ reminder, faded }: { reminder: Reminder; faded?: boolean }) {
  const date = new Date(reminder.eventDate);
  const today = isToday(date);
  const tomorrow = isTomorrow(date);
  const daysUntil = differenceInDays(date, new Date());

  const dateLabel = today
    ? "Today"
    : tomorrow
    ? "Tomorrow"
    : daysUntil > 0
    ? `In ${daysUntil} days`
    : format(date, "MMM d, yyyy");

  const bgColor = today
    ? "border-l-4 border-l-journal-500"
    : tomorrow
    ? "border-l-4 border-l-amber-400"
    : "";

  return (
    <div className={`card flex items-start gap-3 ${faded ? "opacity-50" : ""} ${bgColor}`}>
      <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
        <Calendar className="w-4 h-4 text-purple-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800">{reminder.title}</p>
        {reminder.description && (
          <p className="text-xs text-stone-500 mt-0.5">{reminder.description}</p>
        )}
        <p className={`text-xs mt-1 font-medium ${today ? "text-journal-600" : "text-stone-400"}`}>
          {dateLabel} · {format(date, "h:mm a")}
        </p>
      </div>
    </div>
  );
}
