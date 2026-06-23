"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, addMonths, subMonths,
  startOfWeek, endOfWeek, parseISO, isBefore, startOfDay,
} from "date-fns";
import { useSession } from "next-auth/react";
import type { Task, Reminder } from "@/types";
import { loadDemoState, updateDemoState } from "@/lib/demoData";

// ─── Priority colours ──────────────────────────────────────────────────────────

const PC: Record<string, string> = {
  high:   "#c87a6a",
  medium: "#c8a860",
  low:    "#7a9a7a",
};

// ─── Calendar ──────────────────────────────────────────────────────────────────

function CalendarWidget({
  month, tasks, reminders, selectedDay,
  onSelectDay, onPrev, onNext,
}: {
  month: Date;
  tasks: Task[];
  reminders: Reminder[];
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(month),     { weekStartsOn: 1 }),
  });

  const taskDots   = (d: Date) => tasks.filter(t => t.dueDate && isSameDay(parseISO(t.dueDate), d)).length;
  const remindDots = (d: Date) => reminders.filter(r => isSameDay(parseISO(r.eventDate), d)).length;

  return (
    <div className="card">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onPrev}
          className="w-8 h-8 flex items-center justify-center rounded-full font-mono text-xl
                     text-parchment-700 hover:text-parchment-400 hover:bg-ink-800
                     transition-all focus:outline-none"
        >
          ‹
        </button>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-parchment-400">
          {format(month, "MMMM yyyy")}
        </p>
        <button
          onClick={onNext}
          className="w-8 h-8 flex items-center justify-center rounded-full font-mono text-xl
                     text-parchment-700 hover:text-parchment-400 hover:bg-ink-800
                     transition-all focus:outline-none"
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {["M","T","W","T","F","S","S"].map((d, i) => (
          <div key={i} className="text-center font-mono text-[9px] text-parchment-800 uppercase tracking-wider py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth  = isSameMonth(day, month);
          const selected = isSameDay(day, selectedDay);
          const today    = isToday(day);
          const tCount   = taskDots(day);
          const rCount   = remindDots(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={`
                flex flex-col items-center py-1.5 rounded-lg
                transition-all duration-150 focus:outline-none
                ${!inMonth ? "opacity-20" : ""}
                ${selected
                  ? "bg-gold/15 border border-gold/35"
                  : "border border-transparent hover:bg-ink-800"}
              `}
            >
              <span className={`font-mono text-[11px] leading-none ${
                today && !selected ? "text-gold" :
                selected           ? "text-parchment-100" :
                inMonth            ? "text-parchment-500" : "text-parchment-700"
              }`}>
                {format(day, "d")}
              </span>
              {(tCount > 0 || rCount > 0) && (
                <div className="flex gap-[3px] mt-[3px]">
                  {tCount > 0 && <span className="w-[5px] h-[5px] rounded-full bg-gold/60" />}
                  {rCount > 0 && <span className="w-[5px] h-[5px] rounded-full bg-blue-400/60" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-5 mt-3 pt-2 border-t border-ink-800">
        <div className="flex items-center gap-1.5">
          <span className="w-[5px] h-[5px] rounded-full bg-gold/60" />
          <span className="font-mono text-[9px] text-parchment-800 uppercase tracking-wider">tasks</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-[5px] h-[5px] rounded-full bg-blue-400/60" />
          <span className="font-mono text-[9px] text-parchment-800 uppercase tracking-wider">reminders</span>
        </div>
      </div>
    </div>
  );
}

// ─── Add Item Modal ────────────────────────────────────────────────────────────

interface NewItem {
  type: "task" | "reminder";
  title: string;
  date: string;
  time: string;
  priority: string;
  description: string;
}

function AddItemModal({
  defaultDate, onSave, onClose,
}: {
  defaultDate: Date;
  onSave: (item: NewItem) => Promise<void>;
  onClose: () => void;
}) {
  const [type,        setType]        = useState<"task" | "reminder">("task");
  const [title,       setTitle]       = useState("");
  const [date,        setDate]        = useState(format(defaultDate, "yyyy-MM-dd"));
  const [time,        setTime]        = useState("09:00");
  const [priority,    setPriority]    = useState("medium");
  const [description, setDescription] = useState("");
  const [saving,      setSaving]      = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ type, title: title.trim(), date, time, priority, description: description.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[430px] bg-ink-900 border-t border-ink-700
                      rounded-t-2xl p-5 space-y-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-parchment-600">
            {format(new Date(date + "T12:00:00"), "EEEE, MMM d")}
          </p>
          <button
            onClick={onClose}
            className="text-parchment-700 hover:text-parchment-500 font-mono text-sm
                       w-7 h-7 flex items-center justify-center focus:outline-none"
          >
            ✕
          </button>
        </div>

        {/* Type toggle */}
        <div className="flex gap-2">
          {(["task", "reminder"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-lg font-mono text-[11px] uppercase tracking-wider
                          border transition-all focus:outline-none
                          ${type === t
                            ? "bg-gold/10 border-gold/40 text-parchment-200"
                            : "border-ink-700 text-parchment-700 hover:border-ink-600"}`}
            >
              {t === "task" ? "◈ task" : "◎ reminder"}
            </button>
          ))}
        </div>

        {/* Title */}
        <input
          type="text"
          placeholder={type === "task" ? "What needs doing?" : "What to remember?"}
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="input w-full"
          autoFocus
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />

        {/* Date + Time */}
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input flex-1"
          />
          {type === "reminder" && (
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="input w-28"
            />
          )}
        </div>

        {/* Priority — tasks only */}
        {type === "task" && (
          <div className="flex gap-2">
            {(["high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider
                            border transition-all focus:outline-none`}
                style={priority === p
                  ? { borderColor: PC[p] + "80", color: PC[p], background: PC[p] + "12" }
                  : { borderColor: "#302d29", color: "#6a5a4a" }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Notes */}
        <textarea
          placeholder="Notes (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="textarea w-full"
        />

        <button
          onClick={handleSubmit}
          disabled={!title.trim() || saving}
          className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Adding…" : `Add ${type}`}
        </button>
      </div>
    </div>
  );
}

// ─── Day Panel ─────────────────────────────────────────────────────────────────

function DayPanel({
  day, tasks, reminders, onAddItem, onToggleTask, onDeleteTask, onDeleteReminder,
}: {
  day: Date;
  tasks: Task[];
  reminders: Reminder[];
  onAddItem: () => void;
  onToggleTask: (id: string, completed: boolean) => void;
  onDeleteTask: (id: string) => void;
  onDeleteReminder: (id: string) => void;
}) {
  const dayTasks     = tasks.filter(t => t.dueDate && isSameDay(parseISO(t.dueDate), day));
  const dayReminders = reminders.filter(r => isSameDay(parseISO(r.eventDate), day));
  const isEmpty      = dayTasks.length === 0 && dayReminders.length === 0;
  const dayLabel     = isToday(day) ? "today" : format(day, "EEEE, MMM d");

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="label">{dayLabel}</p>
        <button
          onClick={onAddItem}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full
                     border border-ink-700 hover:border-parchment-700/50
                     font-mono text-[10px] uppercase tracking-wider
                     text-parchment-700 hover:text-parchment-500
                     transition-all focus:outline-none"
        >
          + add
        </button>
      </div>

      {isEmpty && (
        <p className="font-mono text-xs text-parchment-800 py-2">
          nothing here — tap + add to schedule something
        </p>
      )}

      <div className="divide-y divide-ink-800">
        {dayTasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            onToggle={onToggleTask}
            onDelete={onDeleteTask}
          />
        ))}
        {dayReminders.map(reminder => (
          <ReminderRow
            key={reminder.id}
            reminder={reminder}
            onDelete={onDeleteReminder}
            showTime
          />
        ))}
      </div>
    </div>
  );
}

// ─── Shared row components ─────────────────────────────────────────────────────

function TaskRow({
  task, onToggle, onDelete,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        onClick={() => onToggle(task.id, !task.completed)}
        className={`w-4 h-4 rounded-sm border flex-shrink-0 flex items-center justify-center
                    transition-all focus:outline-none
                    ${task.completed ? "bg-gold/25 border-gold/40" : "border-parchment-700 hover:border-parchment-500"}`}
      >
        {task.completed && (
          <span className="text-gold text-[9px] leading-none">✓</span>
        )}
      </button>
      <span
        className="w-[6px] h-[6px] rounded-full flex-shrink-0"
        style={{ backgroundColor: PC[task.priority] ?? PC.medium }}
      />
      <p className={`flex-1 font-mono text-sm ${task.completed ? "line-through text-parchment-700" : "text-parchment-300"}`}>
        {task.title}
      </p>
      <button
        onClick={() => onDelete(task.id)}
        className="text-parchment-800 hover:text-priority-high transition-colors font-mono text-xs focus:outline-none"
      >
        ✕
      </button>
    </div>
  );
}

function ReminderRow({
  reminder, onDelete, showTime = false,
}: {
  reminder: Reminder;
  onDelete: (id: string) => void;
  showTime?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-blue-400/60 font-mono text-[11px] flex-shrink-0 mt-0.5">◎</span>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm text-parchment-300 truncate">{reminder.title}</p>
        {showTime && (
          <p className="font-mono text-[10px] text-parchment-700">
            {format(parseISO(reminder.eventDate), "h:mm a")}
          </p>
        )}
      </div>
      <button
        onClick={() => onDelete(reminder.id)}
        className="text-parchment-800 hover:text-priority-high transition-colors font-mono text-xs focus:outline-none"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Upcoming feed ─────────────────────────────────────────────────────────────

type FeedItem =
  | { kind: "task";     data: Task;     date: Date }
  | { kind: "reminder"; data: Reminder; date: Date };

function UpcomingFeed({
  tasks, reminders, onToggleTask, onDeleteTask, onDeleteReminder,
}: {
  tasks: Task[];
  reminders: Reminder[];
  onToggleTask: (id: string, completed: boolean) => void;
  onDeleteTask: (id: string) => void;
  onDeleteReminder: (id: string) => void;
}) {
  const todayStart = startOfDay(new Date());

  const feed: FeedItem[] = [
    ...tasks
      .filter(t => t.dueDate && !isBefore(parseISO(t.dueDate), todayStart))
      .map(t => ({ kind: "task" as const, data: t, date: parseISO(t.dueDate!) })),
    ...reminders
      .filter(r => !isBefore(parseISO(r.eventDate), todayStart))
      .map(r => ({ kind: "reminder" as const, data: r, date: parseISO(r.eventDate) })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group by date label
  const groups: { label: string; items: FeedItem[] }[] = [];
  for (const item of feed) {
    const label = isToday(item.date) ? "today" : format(item.date, "EEE, MMM d");
    const existing = groups.find(g => g.label === label);
    if (existing) existing.items.push(item);
    else groups.push({ label, items: [item] });
  }

  // Tasks with no due date (undated)
  const undated = tasks.filter(t => !t.dueDate && !t.completed);

  if (groups.length === 0 && undated.length === 0) {
    return (
      <p className="font-mono text-xs text-parchment-800 py-4 text-center">
        nothing upcoming
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <div key={group.label}>
          <p className="label mb-2">{group.label}</p>
          <div className="card divide-y divide-ink-800">
            {group.items.map(item =>
              item.kind === "task" ? (
                <TaskRow
                  key={item.data.id}
                  task={item.data}
                  onToggle={onToggleTask}
                  onDelete={onDeleteTask}
                />
              ) : (
                <ReminderRow
                  key={item.data.id}
                  reminder={item.data}
                  onDelete={onDeleteReminder}
                  showTime
                />
              )
            )}
          </div>
        </div>
      ))}

      {undated.length > 0 && (
        <div>
          <p className="label mb-2">anytime</p>
          <div className="card divide-y divide-ink-800">
            {undated.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={onToggleTask}
                onDelete={onDeleteTask}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const { data: session, status } = useSession();
  const [month,       setMonth]       = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [tasks,       setTasks]       = useState<Task[]>([]);
  const [reminders,   setReminders]   = useState<Reminder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [modalDay,    setModalDay]    = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    if (status === "loading") return;
    if (!session) {
      const demo = loadDemoState();
      setTasks(demo.tasks);
      setReminders(demo.reminders);
      setLoading(false);
      return;
    }
    const [t, r] = await Promise.all([
      fetch("/api/tasks").then(r => r.json()),
      fetch("/api/reminders").then(r => r.json()),
    ]);
    setTasks(Array.isArray(t) ? t : []);
    setReminders(Array.isArray(r) ? r : []);
    setLoading(false);
  }, [session, status]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleToggleTask = useCallback(async (id: string, completed: boolean) => {
    if (!session) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
      updateDemoState((state) => ({
        ...state,
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed } : t)),
      }));
      return;
    }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
  }, [session]);

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!session) {
      setTasks(prev => prev.filter(t => t.id !== id));
      updateDemoState((state) => ({ ...state, tasks: state.tasks.filter((t) => t.id !== id) }));
      return;
    }
    setTasks(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }, [session]);

  const handleDeleteReminder = useCallback(async (id: string) => {
    if (!session) {
      setReminders(prev => prev.filter(r => r.id !== id));
      updateDemoState((state) => ({ ...state, reminders: state.reminders.filter((r) => r.id !== id) }));
      return;
    }
    setReminders(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
  }, [session]);

  const handleSelectDay = useCallback((day: Date) => {
    setSelectedDay(day);
    // Keep month view in sync when clicking a day from a different month
    if (!isSameMonth(day, month)) setMonth(startOfMonth(day));
  }, [month]);

  const handleAddItem = useCallback(async ({ type, title, date, time, priority, description }: {
    type: "task" | "reminder";
    title: string; date: string; time: string; priority: string; description: string;
  }) => {
    if (!session) {
      const now = new Date().toISOString();
      if (type === "task") {
        const task: Task = {
          id: `demo-task-${Date.now()}`,
          title,
          description: description || null,
          dueDate: date ? new Date(date + "T12:00:00").toISOString() : null,
          completed: false,
          priority: priority as Task["priority"],
          source: "manual",
          journalEntryId: null,
          createdAt: now,
          updatedAt: now,
        };
        setTasks(prev => [...prev, task]);
        updateDemoState((state) => ({ ...state, tasks: [...state.tasks, task] }));
      } else {
        const reminder: Reminder = {
          id: `demo-reminder-${Date.now()}`,
          title,
          description: description || null,
          eventDate: new Date(date + "T" + time + ":00").toISOString(),
          reminded: false,
          journalEntryId: null,
          createdAt: now,
        };
        setReminders(prev => [...prev, reminder]);
        updateDemoState((state) => ({ ...state, reminders: [...state.reminders, reminder] }));
      }
      return;
    }
    if (type === "task") {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          dueDate: date ? new Date(date + "T12:00:00").toISOString() : null,
          priority,
        }),
      });
      const task = await res.json();
      setTasks(prev => [...prev, task]);
    } else {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          eventDate: new Date(date + "T" + time + ":00").toISOString(),
        }),
      });
      const reminder = await res.json();
      setReminders(prev => [...prev, reminder]);
    }
  }, [session]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <p className="font-mono text-xs text-parchment-800 uppercase tracking-widest">loading…</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden animate-fade-in">
        {/* Header */}
        <header className="flex items-center justify-between px-5 pt-safe pt-5 pb-4 flex-shrink-0">
          <div>
            <h1 className="font-display text-2xl text-parchment-200 leading-none">schedule</h1>
            <p className="font-mono text-[10px] text-parchment-700 mt-1 tracking-widest uppercase">
              {format(new Date(), "MMM d, yyyy")}
            </p>
          </div>
          <button
            onClick={() => setModalDay(selectedDay)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full
                       border border-gold/30 hover:border-gold/60
                       font-mono text-[11px] uppercase tracking-wider
                       text-gold/70 hover:text-gold transition-all focus:outline-none"
          >
            + new
          </button>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
          <CalendarWidget
            month={month}
            tasks={tasks}
            reminders={reminders}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            onPrev={() => setMonth(m => subMonths(m, 1))}
            onNext={() => setMonth(m => addMonths(m, 1))}
          />

          <DayPanel
            day={selectedDay}
            tasks={tasks}
            reminders={reminders}
            onAddItem={() => setModalDay(selectedDay)}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onDeleteReminder={handleDeleteReminder}
          />

          <p className="label pt-1">upcoming</p>
          <UpcomingFeed
            tasks={tasks}
            reminders={reminders}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onDeleteReminder={handleDeleteReminder}
          />
        </div>
      </div>

      {modalDay && (
        <AddItemModal
          defaultDate={modalDay}
          onSave={handleAddItem}
          onClose={() => setModalDay(null)}
        />
      )}
    </>
  );
}
