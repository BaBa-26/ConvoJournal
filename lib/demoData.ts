import type { JournalEntry, ParsedEntry, Reminder, Task } from "@/types";

export interface DemoState {
  tasks: Task[];
  reminders: Reminder[];
  entries: JournalEntry[];
}

export const DEMO_STORAGE_KEY = "progress-demo-state-v1";

export const DEMO_PROFILE = {
  name: "Demo Writer",
  email: "demo@progress.local",
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeIso(daysOffset: number, hours: number, minutes: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function makeEntryDate(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

function cloneTask(task: Task): Task {
  return { ...task };
}

function cloneReminder(reminder: Reminder): Reminder {
  return { ...reminder };
}

function cloneEntry(entry: JournalEntry): JournalEntry {
  return {
    ...entry,
    tasks: entry.tasks?.map(cloneTask),
    reminders: entry.reminders?.map(cloneReminder),
  };
}

export function createDemoState(): DemoState {
  const now = new Date().toISOString();

  const journalTask: Task = {
    id: "demo-task-refactor-recorder",
    title: "Refactor recorder hooks",
    description: "Split recorder state from transcription flow",
    dueDate: makeIso(0, 14, 0),
    completed: false,
    priority: "medium",
    source: "journal",
    journalEntryId: "demo-entry-today",
    createdAt: now,
    updatedAt: now,
  };

  const manualTask: Task = {
    id: "demo-task-update-review",
    title: "Send project update",
    description: "Summarize the current testing pass",
    dueDate: makeIso(0, 17, 30),
    completed: false,
    priority: "high",
    source: "manual",
    journalEntryId: null,
    createdAt: now,
    updatedAt: now,
  };

  const tomorrowTask: Task = {
    id: "demo-task-book-dentist",
    title: "Book dentist appointment",
    description: null,
    dueDate: makeIso(1, 9, 0),
    completed: false,
    priority: "low",
    source: "manual",
    journalEntryId: null,
    createdAt: now,
    updatedAt: now,
  };

  const reminderToday: Reminder = {
    id: "demo-reminder-call-maya",
    title: "Call Maya about the walk-through",
    description: "Keep it short and confirm the demo steps",
    eventDate: makeIso(0, 18, 15),
    reminded: false,
    journalEntryId: "demo-entry-today",
    createdAt: now,
  };

  const reminderTomorrow: Reminder = {
    id: "demo-reminder-rent",
    title: "Pay rent",
    description: "Send before noon",
    eventDate: makeIso(1, 9, 0),
    reminded: false,
    journalEntryId: null,
    createdAt: now,
  };

  const todayEntry: JournalEntry = {
    id: "demo-entry-today",
    date: makeEntryDate(0),
    rawContent: "Today I need to tighten the journal flow, check the settings page, and make sure the demo store feels believable.",
    yesterday: "Yesterday I cleaned up the layout and resolved the merge conflict.",
    today: "Today I need to polish the testing path and verify the archive lists.",
    tomorrow: "Tomorrow I should do a final pass on the calendar and tasks views.",
    mood: "focused",
    createdAt: now,
    updatedAt: now,
    tasks: [cloneTask(journalTask), cloneTask(manualTask)],
    reminders: [cloneReminder(reminderToday)],
  };

  const yesterdayEntry: JournalEntry = {
    id: "demo-entry-yesterday",
    date: makeEntryDate(-1),
    rawContent: "Yesterday felt productive. I mapped the screens, then took a break before wiring the settings page.",
    yesterday: "Yesterday I mapped the screens and the data flow.",
    today: "Today I want to validate the demo mode with fresh eyes.",
    tomorrow: "Tomorrow I’ll prune any loose UI edges.",
    mood: "calm",
    createdAt: now,
    updatedAt: now,
    tasks: [cloneTask(tomorrowTask)],
    reminders: [],
  };

  const olderEntry: JournalEntry = {
    id: "demo-entry-older",
    date: makeEntryDate(-3),
    rawContent: "A quieter day. I wrote notes, tested the calendar, and logged a few follow-ups.",
    yesterday: "I wrote notes and cleaned up the calendar layout.",
    today: "I want to keep the motion subtle and the copy calm.",
    tomorrow: "Tomorrow I’ll revisit the sidebar and profile page.",
    mood: "steady",
    createdAt: now,
    updatedAt: now,
    tasks: [],
    reminders: [cloneReminder(reminderTomorrow)],
  };

  return {
    tasks: [cloneTask(journalTask), cloneTask(manualTask), cloneTask(tomorrowTask)],
    reminders: [cloneReminder(reminderToday), cloneReminder(reminderTomorrow)],
    entries: [todayEntry, yesterdayEntry, olderEntry],
  };
}

function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const state = value as DemoState;
  return Array.isArray(state.tasks) && Array.isArray(state.reminders) && Array.isArray(state.entries);
}

export function loadDemoState(): DemoState {
  if (typeof window === "undefined") {
    return createDemoState();
  }

  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      const seed = createDemoState();
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }

    const parsed = JSON.parse(raw);
    if (!isDemoState(parsed)) {
      const seed = createDemoState();
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }

    return {
      tasks: parsed.tasks.map(cloneTask),
      reminders: parsed.reminders.map(cloneReminder),
      entries: parsed.entries.map(cloneEntry),
    };
  } catch {
    const seed = createDemoState();
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
}

export function saveDemoState(state: DemoState): DemoState {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  }
  return state;
}

export function resetDemoState(): DemoState {
  return saveDemoState(createDemoState());
}

export function updateDemoState(updater: (state: DemoState) => DemoState): DemoState {
  const nextState = updater(loadDemoState());
  return saveDemoState(nextState);
}

function toJournalText(parsed: ParsedEntry, rawContent: string): string {
  return [parsed.yesterday, parsed.today, parsed.tomorrow, rawContent]
    .filter(Boolean)
    .join(" ");
}

export function appendDemoJournalEntry(rawContent: string, parsed: ParsedEntry): DemoState {
  return updateDemoState((state) => {
    const now = new Date().toISOString();
    const entryId = makeId("demo-entry");
    const nestedTasks: Task[] = parsed.tasks.map((task) => ({
      id: makeId("demo-task"),
      title: task.title,
      description: task.description ?? null,
      dueDate: task.dueDate ?? null,
      completed: false,
      priority: task.priority,
      source: "journal",
      journalEntryId: entryId,
      createdAt: now,
      updatedAt: now,
    }));
    const nestedReminders: Reminder[] = parsed.reminders.map((reminder) => ({
      id: makeId("demo-reminder"),
      title: reminder.title,
      description: reminder.description ?? null,
      eventDate: reminder.eventDate,
      reminded: false,
      journalEntryId: entryId,
      createdAt: now,
    }));

    const entry: JournalEntry = {
      id: entryId,
      date: now,
      rawContent: toJournalText(parsed, rawContent),
      yesterday: parsed.yesterday ?? null,
      today: parsed.today ?? null,
      tomorrow: parsed.tomorrow ?? null,
      mood: parsed.mood ?? null,
      createdAt: now,
      updatedAt: now,
      tasks: nestedTasks.map(cloneTask),
      reminders: nestedReminders.map(cloneReminder),
    };

    return {
      tasks: [...nestedTasks, ...state.tasks],
      reminders: [...nestedReminders, ...state.reminders],
      entries: [entry, ...state.entries],
    };
  });
}