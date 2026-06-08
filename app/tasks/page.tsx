"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Filter } from "lucide-react";
import Navigation from "@/components/Navigation";
import TaskCard from "@/components/TaskCard";
import type { Task } from "@/types";

type Filter = "all" | "pending" | "completed";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newDue, setNewDue] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) setTasks(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleToggle = async (id: string, completed: boolean) => {
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

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          priority: newPriority,
          dueDate: newDue || null,
        }),
      });
      if (res.ok) {
        const task: Task = await res.json();
        setTasks((prev) => [task, ...prev]);
        setNewTitle("");
        setNewDue("");
        setNewPriority("medium");
        setShowAdd(false);
      }
    } finally {
      setAdding(false);
    }
  };

  const filtered = tasks.filter((t) => {
    if (filter === "pending") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  const pendingCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="flex flex-col flex-1">
      <header className="px-4 pt-6 pb-4 bg-white border-b border-stone-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Tasks</h1>
            <p className="text-xs text-stone-400 mt-0.5">{pendingCount} pending</p>
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
        {/* Add task form */}
        {showAdd && (
          <div className="card space-y-3 animate-fade-in">
            <p className="section-label">New Task</p>
            <input
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-journal-400 focus:border-transparent"
              placeholder="Task title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <div className="flex gap-2">
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as "high" | "medium" | "low")}
                className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-journal-400"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
              <input
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-journal-400"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAdd} disabled={!newTitle.trim() || adding} className="btn-primary flex-1">
                {adding ? "Adding..." : "Add Task"}
              </button>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex bg-stone-100 rounded-xl p-1 gap-1">
          {(["all", "pending", "completed"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all duration-150
                ${filter === f ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div className="text-center py-12 text-stone-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Filter className="w-8 h-8 text-stone-200 mx-auto mb-2" />
            <p className="text-stone-400 text-sm">No {filter !== "all" ? filter : ""} tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => (
              <TaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
}
