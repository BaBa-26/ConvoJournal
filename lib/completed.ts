import type { Task, Reminder } from "@/types";

// The completed-item lifecycle (BUILD_SPEC 0c): a finished task vanishes from *active* views
// ~24h after completion, but is NEVER deleted — `completedAt` is Phase 5's raw material
// (completion ratio, momentum ribbon). Hiding is a pure view concern; the row stays in the DB
// and remains visible in the Tasks "completed" archive forever.

export const COMPLETED_HIDE_MS = 24 * 60 * 60 * 1000;

// The cutoff is computed server-side (GET /api/tasks sends it as `x-completed-cutoff`) so the
// window is anchored to authoritative server time, not a possibly-skewed client clock. Falls
// back to the client clock if the header is missing (e.g. demo/local mode has no server call).
export function readCompletedCutoff(res: Response | null): number {
  const header = res?.headers.get("x-completed-cutoff");
  const parsed = header ? Date.parse(header) : NaN;
  return isNaN(parsed) ? Date.now() - COMPLETED_HIDE_MS : parsed;
}

// True when a task is completed and its completion is older than the cutoff → hide it from
// active surfaces (Tasks "all", the day panel, the upcoming feed). A completed task with no
// `completedAt` (legacy rows pre-backfill) is treated as still-recent so it never silently
// disappears before the backfill runs.
export function isTaskCleared(task: Pick<Task, "completed" | "completedAt">, cutoffMs: number): boolean {
  if (!task.completed || !task.completedAt) return false;
  return new Date(task.completedAt).getTime() < cutoffMs;
}

// Reminders have no `completedAt`; the analogous rule is "its moment has passed and it already
// fired" — a past event that's been `reminded` is done and leaves the active surfaces.
export function isReminderCleared(reminder: Pick<Reminder, "eventDate" | "reminded">, nowMs: number): boolean {
  return reminder.reminded && new Date(reminder.eventDate).getTime() < nowMs;
}
