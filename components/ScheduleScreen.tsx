"use client";

import { useState, useEffect, useCallback } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isSameMonth, isToday, addMonths, subMonths,
  startOfWeek, endOfWeek, parseISO, isBefore, startOfDay,
} from "date-fns";
import { useSession } from "next-auth/react";
import type { Task, Reminder } from "@/types";
import { loadLocal, updateLocal } from "@/lib/localStore";
import { useDataMode } from "@/components/PreferencesProvider";
import ItemEditModal, { type NewItem } from "@/components/ItemEditModal";
import { convertItemRemote, convertItemDemo } from "@/lib/itemConvert";

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

// ─── Day Panel ─────────────────────────────────────────────────────────────────

function DayPanel({
  day, tasks, reminders, onAddItem, onToggleTask, onEditTask, onEditReminder, onDeleteTask, onDeleteReminder,
}: {
  day: Date;
  tasks: Task[];
  reminders: Reminder[];
  onAddItem: () => void;
  onToggleTask: (id: string, completed: boolean) => void;
  onEditTask: (task: Task) => void;
  onEditReminder: (reminder: Reminder) => void;
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
            onEdit={onEditTask}
            onDelete={onDeleteTask}
          />
        ))}
        {dayReminders.map(reminder => (
          <ReminderRow
            key={reminder.id}
            reminder={reminder}
            onEdit={onEditReminder}
            onDelete={onDeleteReminder}
            showTime
          />
        ))}
      </div>
    </div>
  );
}

// ─── Shared row components ─────────────────────────────────────────────────────

// Small pencil-edit control shared by both row types.
function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="text-parchment-800 hover:text-parchment-400 transition-colors focus:outline-none flex-shrink-0"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  );
}

function TaskRow({
  task, onToggle, onEdit, onDelete,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
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
      <EditButton onClick={() => onEdit(task)} label="Edit task" />
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
  reminder, onEdit, onDelete, showTime = false,
}: {
  reminder: Reminder;
  onEdit: (reminder: Reminder) => void;
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
      <EditButton onClick={() => onEdit(reminder)} label="Edit reminder" />
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
  tasks, reminders, onToggleTask, onEditTask, onEditReminder, onDeleteTask, onDeleteReminder,
}: {
  tasks: Task[];
  reminders: Reminder[];
  onToggleTask: (id: string, completed: boolean) => void;
  onEditTask: (task: Task) => void;
  onEditReminder: (reminder: Reminder) => void;
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
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                />
              ) : (
                <ReminderRow
                  key={item.data.id}
                  reminder={item.data}
                  onEdit={onEditReminder}
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
                onEdit={onEditTask}
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
  const { status } = useSession();
  const dataMode = useDataMode();
  const remote = dataMode === "remote";
  const [month,       setMonth]       = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [tasks,       setTasks]       = useState<Task[]>([]);
  const [reminders,   setReminders]   = useState<Reminder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [modalDay,    setModalDay]    = useState<Date | null>(null);
  const [editItem,    setEditItem]    = useState<{ kind: "task" | "reminder"; data: Task | Reminder } | null>(null);

  const fetchAll = useCallback(async () => {
    if (status === "loading") return;
    if (!remote) {
      const local = loadLocal();
      setTasks(local.tasks);
      setReminders(local.reminders);
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
  }, [remote, status]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleToggleTask = useCallback(async (id: string, completed: boolean) => {
    if (!remote) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
      updateLocal((state) => ({
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
  }, [remote]);

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!remote) {
      setTasks(prev => prev.filter(t => t.id !== id));
      updateLocal((state) => ({ ...state, tasks: state.tasks.filter((t) => t.id !== id) }));
      return;
    }
    setTasks(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }, [remote]);

  const handleDeleteReminder = useCallback(async (id: string) => {
    if (!remote) {
      setReminders(prev => prev.filter(r => r.id !== id));
      updateLocal((state) => ({ ...state, reminders: state.reminders.filter((r) => r.id !== id) }));
      return;
    }
    setReminders(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/reminders/${id}`, { method: "DELETE" });
  }, [remote]);

  const handleSelectDay = useCallback((day: Date) => {
    setSelectedDay(day);
    // Keep month view in sync when clicking a day from a different month
    if (!isSameMonth(day, month)) setMonth(startOfMonth(day));
  }, [month]);

  const handleAddItem = useCallback(async (item: NewItem) => {
    const { type, title, date, time, priority, description } = item;
    // A goal has no place on the calendar itself — create it (it shows on the Goals screen).
    if (type === "goal") {
      if (!remote) {
        const now = new Date().toISOString();
        const goal = {
          id: `demo-goal-${Date.now()}`, title, unit: item.unit, target: item.target, current: 0,
          step: item.step, period: item.period, startDate: now, completed: false, completedAt: null,
          source: "manual", createdAt: now, updatedAt: now,
        };
        updateLocal((state) => ({ ...state, goals: [goal, ...state.goals] }));
      } else {
        await fetch("/api/goals", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, unit: item.unit, target: item.target, step: item.step, period: item.period }),
        });
      }
      return;
    }
    if (!remote) {
      const now = new Date().toISOString();
      if (type === "task") {
        const task: Task = {
          id: `demo-task-${Date.now()}`,
          title,
          description: description || null,
          dueDate: date ? new Date(date + "T12:00:00").toISOString() : null,
          completed: false,
          progress: 0,
          priority: priority as Task["priority"],
          source: "manual",
          journalEntryId: null,
          createdAt: now,
          updatedAt: now,
        };
        setTasks(prev => [...prev, task]);
        updateLocal((state) => ({ ...state, tasks: [...state.tasks, task] }));
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
        updateLocal((state) => ({ ...state, reminders: [...state.reminders, reminder] }));
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
  }, [remote]);

  const handleEditTask     = useCallback((task: Task)         => setEditItem({ kind: "task",     data: task }),     []);
  const handleEditReminder = useCallback((reminder: Reminder) => setEditItem({ kind: "reminder", data: reminder }), []);

  const handleUpdateItem = useCallback(async (item: NewItem, editId: string) => {
    const fromKind = editItem?.kind ?? "task";

    // Type changed → convert: create the target row, delete the source, and move it between
    // this screen's lists (a goal target lands on the Goals screen, so nothing to add here).
    if (item.type !== fromKind) {
      const created = remote
        ? await convertItemRemote(fromKind, editId, item)
        : convertItemDemo(fromKind, editId, item);
      if (fromKind === "task")     setTasks(prev => prev.filter(t => t.id !== editId));
      if (fromKind === "reminder") setReminders(prev => prev.filter(r => r.id !== editId));
      if (created && item.type === "task")     setTasks(prev => [...prev, created as Task]);
      if (created && item.type === "reminder") setReminders(prev => [...prev, created as Reminder]);
      return;
    }

    if (item.type === "task") {
      const dueDate = item.date ? new Date(item.date + "T12:00:00").toISOString() : null;
      const patch = { title: item.title, priority: item.priority, dueDate, description: item.description || null };
      const apply = (t: Task): Task => ({
        ...t, title: item.title, priority: item.priority as Task["priority"], dueDate, description: item.description || null,
      });
      if (!remote) {
        setTasks(prev => prev.map(t => t.id === editId ? apply(t) : t));
        updateLocal((state) => ({ ...state, tasks: state.tasks.map(t => t.id === editId ? apply(t) : t) }));
        return;
      }
      setTasks(prev => prev.map(t => t.id === editId ? apply(t) : t)); // optimistic
      const res = await fetch(`/api/tasks/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) { const updated = await res.json(); setTasks(prev => prev.map(t => t.id === editId ? updated : t)); }
    } else {
      const eventDate = new Date(item.date + "T" + item.time + ":00").toISOString();
      const patch = { title: item.title, eventDate, description: item.description || null };
      const apply = (r: Reminder): Reminder => ({ ...r, title: item.title, eventDate, description: item.description || null });
      if (!remote) {
        setReminders(prev => prev.map(r => r.id === editId ? apply(r) : r));
        updateLocal((state) => ({ ...state, reminders: state.reminders.map(r => r.id === editId ? apply(r) : r) }));
        return;
      }
      setReminders(prev => prev.map(r => r.id === editId ? apply(r) : r)); // optimistic
      const res = await fetch(`/api/reminders/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) { const updated = await res.json(); setReminders(prev => prev.map(r => r.id === editId ? updated : r)); }
    }
  }, [remote, editItem]);

  // Modal entry point — routes to create or update based on whether an id is supplied.
  const handleSaveItem = useCallback(async (item: NewItem, editId?: string) => {
    if (editId) return handleUpdateItem(item, editId);
    return handleAddItem(item);
  }, [handleUpdateItem, handleAddItem]);

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
            className="mr-12 md:mr-0 flex items-center gap-1.5 px-4 py-2 rounded-full
                       border border-gold/30 hover:border-gold/60
                       font-mono text-[11px] uppercase tracking-wider
                       text-gold/70 hover:text-gold transition-all focus:outline-none"
          >
            + new
          </button>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-nav space-y-4">
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
            onEditTask={handleEditTask}
            onEditReminder={handleEditReminder}
            onDeleteTask={handleDeleteTask}
            onDeleteReminder={handleDeleteReminder}
          />

          <p className="label pt-1">upcoming</p>
          <UpcomingFeed
            tasks={tasks}
            reminders={reminders}
            onToggleTask={handleToggleTask}
            onEditTask={handleEditTask}
            onEditReminder={handleEditReminder}
            onDeleteTask={handleDeleteTask}
            onDeleteReminder={handleDeleteReminder}
          />
        </div>
      </div>

      {(modalDay || editItem) && (
        <ItemEditModal
          defaultDate={editItem ? selectedDay : (modalDay as Date)}
          editItem={editItem}
          onSave={handleSaveItem}
          onClose={() => { setModalDay(null); setEditItem(null); }}
        />
      )}
    </>
  );
}
