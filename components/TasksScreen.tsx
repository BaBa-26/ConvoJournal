"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useSession, signIn } from "next-auth/react";
import type { Task, TaskFilter } from "@/types";
import { loadLocal, updateLocal } from "@/lib/localStore";
import { useDataMode } from "@/components/PreferencesProvider";
import { computeTaskStats } from "@/lib/taskStats";
import DraggableProgressBar from "@/components/DraggableProgressBar";
import GoalsSection from "@/components/GoalsSection";
import ItemEditModal, { type NewItem } from "@/components/ItemEditModal";

// ─── Shared auth gate ─────────────────────────────────────────────────────────

function AuthGate({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8">
      <div className="text-center space-y-2">
        <p className="font-mono text-3xl text-parchment-800">◈</p>
        <h2 className="font-display text-xl text-parchment-300">Sign in to view your {feature}</h2>
        <p className="font-mono text-xs text-parchment-700 leading-6">
          Your journal data is private and<br />tied to your account.
        </p>
      </div>
      <button
        onClick={() => signIn()}
        className="btn-primary px-8"
      >
        Sign in
      </button>
      <p className="font-mono text-[9px] text-parchment-800 tracking-widest uppercase">
        Voice recording still works without signing in
      </p>
    </div>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   "#c87a6a",
  medium: "#c8a860",
  low:    "#7a9a7a",
};

// ─── Individual task row ──────────────────────────────────────────────────────

function TaskRow({
  task,
  showProgress,
  onToggle,
  onEdit,
  onDelete,
  onProgressCommit,
}: {
  task: Task;
  showProgress: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onProgressCommit: (id: string, progress: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  // Local progress for live drag feedback; falls back to the server value when idle.
  const [localProgress, setLocalProgress] = useState(task.progress ?? 0);
  useEffect(() => { setLocalProgress(task.progress ?? 0); }, [task.progress]);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(task.id);
  };

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3.5 rounded-xl border
        transition-all duration-200
        ${task.completed
          ? "bg-ink-900/40 border-ink-700/40 opacity-50"
          : "bg-ink-900 border-ink-700"
        }
      `}
    >
      {/* Checkbox — 44px touch target via padding */}
      <button
        onClick={() => onToggle(task.id, !task.completed)}
        className="flex-shrink-0 -ml-1 p-1 rounded-lg focus:outline-none"
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
      >
        <div
          className={`
            w-5 h-5 rounded-md border-2 flex items-center justify-center
            transition-all duration-150
            ${task.completed
              ? "border-transparent bg-accent"
              : "border-parchment-700 hover:border-accent/60"
            }
          `}
        >
          {task.completed && (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
              <path d="M1 4L4 7.5L10 1" stroke="#0f0e0b" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className={`font-mono text-sm leading-5 ${
          task.completed ? "line-through text-parchment-700" : "text-parchment-300"
        }`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Priority dot + label */}
          <span className="flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium }}
            />
            <span className="font-mono text-[9px] uppercase tracking-widest text-parchment-700">
              {task.priority}
            </span>
          </span>
          {/* Due date */}
          {task.dueDate && (
            <>
              <span className="text-parchment-700 text-[9px]">·</span>
              <span className="font-mono text-[9px] text-parchment-700">
                {format(new Date(task.dueDate), "MMM d")}
              </span>
            </>
          )}
          {/* Source badge */}
          {task.source === "journal" && (
            <>
              <span className="text-parchment-700 text-[9px]">·</span>
              <span className="font-mono text-[9px] text-parchment-700 italic">from journal</span>
            </>
          )}
        </div>

        {/* Draggable progress — hidden in checklist view and once complete (bar would just be full) */}
        {showProgress && !task.completed && (
          <DraggableProgressBar
            progress={localProgress}
            onChangeLive={setLocalProgress}
            onCommit={(p) => onProgressCommit(task.id, p)}
          />
        )}
      </div>

      {/* Edit + Delete */}
      <div className="flex-shrink-0 flex items-center">
        <button
          onClick={() => onEdit(task)}
          className="p-1.5 rounded-lg text-parchment-700
                     hover:text-parchment-300 transition-colors focus:outline-none
                     min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Edit task"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 -mr-1 rounded-lg text-parchment-700
                     hover:text-priority-high transition-colors focus:outline-none
                     min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Delete task"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Add task form ────────────────────────────────────────────────────────────

function AddTaskForm({ onAdd, onCancel }: { onAdd: (t: Partial<Task>) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [due, setDue] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), priority, dueDate: due || undefined });
    setTitle(""); setPriority("medium"); setDue("");
  };

  return (
    <div className="card space-y-3 animate-slide-up">
      <p className="label">New Task</p>

      <input
        className="input"
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        autoFocus
      />

      <div className="flex gap-2">
        {/* Priority select */}
        <div className="relative flex-1">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task["priority"])}
            className="input appearance-none pr-8 cursor-pointer"
          >
            <option value="high">↑ High</option>
            <option value="medium">→ Medium</option>
            <option value="low">↓ Low</option>
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-parchment-700 pointer-events-none text-xs">▾</span>
        </div>

        {/* Due date */}
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="input flex-1"
        />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
        <button onClick={handleSubmit} disabled={!title.trim()} className="btn-primary flex-1">
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type TabKey = "goals" | "tasks";

export default function TasksScreen() {
  const { data: session, status } = useSession();
  const dataMode = useDataMode();
  const remote = dataMode === "remote";
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [filter, setFilter]     = useState<TaskFilter>("pending");
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [taskView, setTaskView] = useState<"bars" | "list">("bars");
  const [tab, setTab]           = useState<TabKey>("goals");

  const fetchTasks = useCallback(async () => {
    if (status === "loading") return;
    if (!remote) {
      setTasks(loadLocal().tasks);
      setLoading(false);
      return;
    }
    const res = await fetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  }, [remote, status]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleToggle = async (id: string, completed: boolean) => {
    // Completing a task snaps progress to 100 + stamps completedAt (mirrors the API sync rule).
    const patch = (t: Task): Task => ({
      ...t, completed, progress: completed ? 100 : t.progress,
      completedAt: completed ? new Date().toISOString() : null,
    });
    if (!remote) {
      setTasks((prev) => prev.map((t) => (t.id === id ? patch(t) : t)));
      updateLocal((state) => ({
        ...state,
        tasks: state.tasks.map((t) => (t.id === id ? patch(t) : t)),
      }));
      return;
    }
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (res.ok) {
      const updated: Task = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
  };

  const handleProgressCommit = async (id: string, progress: number) => {
    const completed = progress >= 100;
    const patch = (t: Task): Task => ({ ...t, progress, completed, completedAt: completed ? new Date().toISOString() : t.completedAt ?? null });
    if (!remote) {
      setTasks((prev) => prev.map((t) => (t.id === id ? patch(t) : t)));
      updateLocal((state) => ({
        ...state,
        tasks: state.tasks.map((t) => (t.id === id ? patch(t) : t)),
      }));
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === id ? patch(t) : t))); // optimistic
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress }),
    });
    if (res.ok) {
      const updated: Task = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!remote) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      updateLocal((state) => ({
        ...state,
        tasks: state.tasks.filter((t) => t.id !== id),
      }));
      return;
    }
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAdd = async (data: Partial<Task>) => {
    if (!remote) {
      const now = new Date().toISOString();
      const task: Task = {
        id: `demo-task-${Date.now()}`,
        title: data.title ?? "Untitled task",
        description: data.description ?? null,
        dueDate: data.dueDate ?? null,
        completed: false,
        progress: 0,
        priority: data.priority ?? "medium",
        source: "manual",
        journalEntryId: null,
        createdAt: now,
        updatedAt: now,
      };
      setTasks((prev) => [task, ...prev]);
      updateLocal((state) => ({ ...state, tasks: [task, ...state.tasks] }));
      setShowAdd(false);
      return;
    }
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const task: Task = await res.json();
      setTasks((prev) => [task, ...prev]);
      setShowAdd(false);
    }
  };

  // Edit an existing task via the shared modal. `date` empty → clears the due date.
  const handleUpdate = async (item: NewItem, editId?: string) => {
    if (!editId) return;
    const dueDate = item.date ? new Date(item.date + "T12:00:00").toISOString() : null;
    const apply = (t: Task): Task => ({
      ...t,
      title: item.title,
      priority: item.priority as Task["priority"],
      dueDate,
      description: item.description || null,
    });
    if (!remote) {
      setTasks((prev) => prev.map((t) => (t.id === editId ? apply(t) : t)));
      updateLocal((state) => ({
        ...state,
        tasks: state.tasks.map((t) => (t.id === editId ? apply(t) : t)),
      }));
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === editId ? apply(t) : t))); // optimistic
    const res = await fetch(`/api/tasks/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: item.title,
        priority: item.priority,
        dueDate,
        description: item.description || null,
      }),
    });
    if (res.ok) {
      const updated: Task = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === editId ? updated : t)));
    }
  };

  const filtered = tasks.filter((t) =>
    filter === "pending"   ? !t.completed :
    filter === "completed" ? t.completed  : true
  );

  const pending = tasks.filter((t) => !t.completed).length;
  const stats = computeTaskStats(tasks);

  // ── Auth gate ──────────────────────────────────────────
  if (false && status !== "loading" && !session) {
    return <AuthGate feature="tasks" />;
  }

  return (
   <>
    <div className="flex flex-col flex-1 overflow-hidden animate-fade-in">
      {/* Header */}
      <header className="px-5 pt-safe pt-5 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl text-parchment-200">To-Do&apos;s</h1>
            <p className="font-mono text-[10px] text-parchment-700 mt-1 tracking-widest uppercase">
              {tab === "goals" ? "tracked targets" : `${pending} pending`}
            </p>
          </div>
          {/* Add button — only for Tasks (Goals has its own add control) */}
          {tab === "tasks" && (
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="mr-12 md:mr-0 w-11 h-11 rounded-full border border-accent/40 flex items-center justify-center
                         text-accent hover:bg-accent/10 transition-all active:scale-95 focus:outline-none"
              aria-label="Add task"
            >
              <span className="text-xl leading-none">{showAdd ? "×" : "+"}</span>
            </button>
          )}
        </div>

        {/* Goals / Tasks switcher */}
        <div className="mt-4 flex gap-1.5 bg-ink-900 rounded-xl p-1">
          {(["goals", "tasks"] as TabKey[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`
                flex-1 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest
                transition-all duration-150 min-h-[38px]
                ${tab === t
                  ? "bg-ink-700 text-parchment-200 shadow-sm"
                  : "text-parchment-700 hover:text-parchment-500"
                }
              `}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Task progress overview — only under the Tasks tab */}
        {tab === "tasks" && !loading && stats.total > 0 && (
          <div className="mt-4 bg-ink-900 border border-ink-700 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-parchment-700">
                {stats.done} of {stats.total} complete
              </span>
              <span className="font-display italic text-base text-accent leading-none">{stats.completionPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${stats.completionPct}%` }}
              />
            </div>
            <div className="flex items-center gap-4 pt-0.5">
              {(["high", "medium", "low"] as const).map((p) => (
                <span key={p} className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLORS[p] }}
                  />
                  <span className="font-mono text-[9px] text-parchment-700">
                    {stats.byPriority[p]} {p}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-nav">
        {tab === "goals" ? (
          /* Goals — tracked targets with unit-aware progress */
          <GoalsSection />
        ) : (
          <>
            {/* Add form */}
            {showAdd && (
              <AddTaskForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
            )}

            {/* Filter pills + progress/checklist view toggle */}
            <div className="flex gap-1.5">
              <div className="flex gap-1.5 bg-ink-900 rounded-xl p-1 flex-1">
                {(["all", "pending", "completed"] as TaskFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`
                      flex-1 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest
                      transition-all duration-150 min-h-[36px]
                      ${filter === f
                        ? "bg-ink-700 text-parchment-200 shadow-sm"
                        : "text-parchment-700 hover:text-parchment-500"
                      }
                    `}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 bg-ink-900 rounded-xl p-1 flex-shrink-0">
                {([
                  { key: "bars", label: "progress", icon: "▤" },
                  { key: "list", label: "checklist", icon: "☰" },
                ] as const).map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setTaskView(v.key)}
                    aria-label={v.label}
                    title={v.label}
                    className={`
                      w-10 rounded-lg text-sm leading-none min-h-[36px] flex items-center justify-center
                      transition-all duration-150
                      ${taskView === v.key
                        ? "bg-ink-700 text-parchment-200 shadow-sm"
                        : "text-parchment-700 hover:text-parchment-500"
                      }
                    `}
                  >
                    {v.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-cleanup notice — shown when completed tasks are on screen */}
            {!loading && filtered.some((t) => t.completed) && (
              <p className="font-mono text-[10px] leading-relaxed text-parchment-700 bg-ink-900/60
                            border border-ink-700/60 rounded-lg px-3 py-2 tracking-wide">
                Completed tasks clear about 24h after you finish them — the win still counts, we just
                keep this list from piling up.
              </p>
            )}

            {/* List */}
            {loading ? (
              <div className="text-center py-16">
                <p className="font-mono text-xs text-parchment-700 tracking-widest">loading…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <p className="font-mono text-2xl text-parchment-800">◈</p>
                <p className="font-mono text-xs text-parchment-700 tracking-wide">
                  {filter === "pending" ? "nothing pending" :
                   filter === "completed" ? "nothing completed yet" : "no tasks yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 animate-fade-in">
                {filtered.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    showProgress={taskView === "bars"}
                    onToggle={handleToggle}
                    onEdit={setEditTask}
                    onDelete={handleDelete}
                    onProgressCommit={handleProgressCommit}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>

    {editTask && (
      <ItemEditModal
        defaultDate={new Date()}
        lockType="task"
        editItem={{ kind: "task", data: editTask }}
        onSave={handleUpdate}
        onClose={() => setEditTask(null)}
      />
    )}
   </>
  );
}
