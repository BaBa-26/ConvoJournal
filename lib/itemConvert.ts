import type { Task, Reminder, Goal } from "@/types";
import type { NewItem, ItemKind } from "@/components/ItemEditModal";
import { updateLocal } from "@/lib/localStore";
import { localDateToISO } from "@/lib/dates";

// Category conversion — re-homes an item between the task / reminder / goal tables.
// A task and a reminder and a goal live in different tables, so "converting" means:
// create a fresh row in the target table from the edited fields, then delete the source.
// Both the remote (API) and demo (localStore) paths are provided so the two behave alike.

const isoDue   = (date: string) => (date ? localDateToISO(date) : null);
const isoEvent = (date: string, time: string) => localDateToISO(date, time || "09:00");

const ENDPOINT: Record<ItemKind, string> = {
  task:     "/api/tasks",
  reminder: "/api/reminders",
  goal:     "/api/goals",
};

function createBody(item: NewItem): Record<string, unknown> {
  if (item.type === "task")     return { title: item.title, description: item.description || null, dueDate: isoDue(item.date), priority: item.priority };
  if (item.type === "reminder") return { title: item.title, description: item.description || null, eventDate: isoEvent(item.date, item.time) };
  return { title: item.title, unit: item.unit, target: item.target, step: item.step, period: item.period };
}

// Remote: POST the new target row, then DELETE the source. Returns the created row (or null on failure).
export async function convertItemRemote(
  fromKind: ItemKind, fromId: string, item: NewItem,
): Promise<Task | Reminder | Goal | null> {
  const res = await fetch(ENDPOINT[item.type], {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(createBody(item)),
  });
  if (!res.ok) return null;
  const created = await res.json();
  await fetch(`${ENDPOINT[fromKind]}/${fromId}`, { method: "DELETE" });
  return created;
}

// Demo: build the target row locally, add it to localStore, and remove the source. Returns the created row.
export function convertItemDemo(
  fromKind: ItemKind, fromId: string, item: NewItem,
): Task | Reminder | Goal {
  const now = new Date().toISOString();
  let created: Task | Reminder | Goal;
  if (item.type === "task") {
    created = {
      id: `demo-task-${Date.now()}`, title: item.title, description: item.description || null,
      dueDate: isoDue(item.date), completed: false, completedAt: null, progress: 0,
      priority: item.priority as Task["priority"], source: "manual", journalEntryId: null,
      createdAt: now, updatedAt: now,
    };
  } else if (item.type === "reminder") {
    created = {
      id: `demo-reminder-${Date.now()}`, title: item.title, description: item.description || null,
      eventDate: isoEvent(item.date, item.time), reminded: false, journalEntryId: null, createdAt: now,
    };
  } else {
    created = {
      id: `demo-goal-${Date.now()}`, title: item.title, unit: item.unit, target: item.target,
      current: 0, step: item.step, period: item.period, startDate: now, completed: false,
      completedAt: null, source: "manual", createdAt: now, updatedAt: now,
    };
  }

  updateLocal((state) => {
    const next = { ...state };
    if (fromKind === "task")     next.tasks     = next.tasks.filter((t) => t.id !== fromId);
    if (fromKind === "reminder") next.reminders = next.reminders.filter((r) => r.id !== fromId);
    if (fromKind === "goal")     next.goals     = next.goals.filter((g) => g.id !== fromId);
    if (item.type === "task")     next.tasks     = [created as Task, ...next.tasks];
    if (item.type === "reminder") next.reminders = [...next.reminders, created as Reminder];
    if (item.type === "goal")     next.goals     = [created as Goal, ...next.goals];
    return next;
  });
  return created;
}
