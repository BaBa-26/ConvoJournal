"use client";

import { useState } from "react";
import { format, isPast, isToday } from "date-fns";
import { Trash2 } from "lucide-react";
import type { Task } from "@/types";

interface TaskCardProps {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

const priorityColors = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-green-100 text-green-700",
};

export default function TaskCard({ task, onToggle, onDelete }: TaskCardProps) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    await onToggle(task.id, !task.completed);
    setLoading(false);
  };

  const dueDateDate = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = dueDateDate && isPast(dueDateDate) && !isToday(dueDateDate) && !task.completed;

  return (
    <div className={`card flex items-start gap-3 ${task.completed ? "opacity-60" : ""}`}>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all duration-150
          ${task.completed
            ? "bg-journal-500 border-journal-500"
            : "border-stone-300 hover:border-journal-400"
          }`}
        aria-label="Toggle task"
      >
        {task.completed && (
          <svg className="w-full h-full p-0.5" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.completed ? "line-through text-stone-400" : "text-stone-800"}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityColors[task.priority as keyof typeof priorityColors] ?? priorityColors.medium}`}>
            {task.priority}
          </span>
          {dueDateDate && (
            <span className={`text-[10px] ${overdue ? "text-red-500 font-semibold" : "text-stone-400"}`}>
              {overdue ? "Overdue · " : ""}{format(dueDateDate, "MMM d")}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className="text-stone-300 hover:text-red-400 transition-colors p-1"
        aria-label="Delete task"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
