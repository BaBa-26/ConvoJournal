import type { Task, TaskStats } from "@/types";

// Pure task aggregation, shared by the Goals screen header and the Today "This week"
// stat widget so the Done/Pending math lives in exactly one place.
export function computeTaskStats(tasks: Task[]): TaskStats {
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pending = total - done;
  const completionPct = total === 0 ? 0 : Math.round((done / total) * 100);

  const byPriority = { high: 0, medium: 0, low: 0 };
  for (const t of tasks) {
    if (!t.completed) byPriority[t.priority] += 1;
  }

  return { entries: 0, done, pending, total, completionPct, byPriority };
}
