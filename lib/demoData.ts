import type { Goal, JournalEntry, ParsedEntry, Reminder, Task, UserPreferences } from "@/types";
import { DEFAULT_PREFERENCES } from "@/types";

export interface DemoState {
  tasks: Task[];
  reminders: Reminder[];
  entries: JournalEntry[];
  goals: Goal[];
  preferences: UserPreferences;
  // Seed provenance — used to keep the demo pristine & consistent across visits.
  seedVersion: number;
  seedDay: string; // YYYY-MM-DD the seed was anchored to (local time)
}

export const DEMO_STORAGE_KEY = "progress-demo-state-v1";

// Bump to force every device back to a fresh seed after the seed content changes.
export const DEMO_SEED_VERSION = 4;

// Local-time day key. The seed reseeds when this rolls over so every visitor keeps seeing the
// same small set of sample entries, anchored to *their* today (streak/heatmap stay correct).
function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

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

function cloneGoal(goal: Goal): Goal {
  return { ...goal };
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
    progress: 40,
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
    progress: 75,
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
    progress: 0,
    priority: "low",
    source: "manual",
    journalEntryId: null,
    createdAt: now,
    updatedAt: now,
  };

  const doneTask: Task = {
    id: "demo-task-ship-fix",
    title: "Ship reminders auth fix",
    description: "Add ownership check to PATCH/DELETE",
    dueDate: makeIso(-1, 16, 0),
    completed: true,
    progress: 100,
    priority: "high",
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

  // Filler entries so the streak/heatmap has a real run of consecutive days.
  // Combined with today/-1/-3 above this yields an unbroken 0..-6 streak, then a gap.
  // Each carries distinct, believable content so the history doesn't read as spam.
  const fillerContent: {
    offset: number;
    mood: string;
    yesterday: string;
    today: string;
    tomorrow: string;
    rawContent: string;
  }[] = [
    {
      offset: -2, mood: "focused",
      yesterday: "Wrapped the calendar refactor and cleared the review queue.",
      today: "Keep today lighter — one deep task, then a walk.",
      tomorrow: "Draft the weekly digest copy.",
      rawContent: "Solid day. Shipped the calendar edits and stepped away before I got tired.",
    },
    {
      offset: -4, mood: "tired",
      yesterday: "Long call with the team — lots of ideas, no decisions.",
      today: "Trim the scope and pick the one thing that matters.",
      tomorrow: "Prototype the mood filter.",
      rawContent: "Felt scattered today. Too many tabs open, literally and mentally.",
    },
    {
      offset: -5, mood: "calm",
      yesterday: "Read for an hour instead of scrolling — small win.",
      today: "Carry that calm into the afternoon block.",
      tomorrow: "Call Mom back.",
      rawContent: "Quiet morning. The reading habit is starting to stick.",
    },
    {
      offset: -6, mood: "bright",
      yesterday: "Fixed the reminders bug that had been nagging me for days.",
      today: "Celebrate a little, then start the next thing fresh.",
      tomorrow: "Sketch the goals dashboard.",
      rawContent: "Relief — that bug is finally gone and the tests are green.",
    },
    {
      offset: -9, mood: "steady",
      yesterday: "Rest day. Didn't touch the laptop and don't regret it.",
      today: "Ease back in gently — inbox, then one task.",
      tomorrow: "Plan the week properly this time.",
      rawContent: "Needed the break. Back today with a clearer head.",
    },
    {
      offset: -10, mood: "focused",
      yesterday: "Mapped out the next two weeks on paper.",
      today: "Follow the plan I made — resist the urge to replan.",
      tomorrow: "Ship something small and visible.",
      rawContent: "Planning day. Feels good to see the whole shape of it.",
    },
  ];
  const fillerEntries: JournalEntry[] = fillerContent.map((c) => ({
    id: `demo-entry-filler-${Math.abs(c.offset)}`,
    date: makeEntryDate(c.offset),
    rawContent: c.rawContent,
    yesterday: c.yesterday,
    today: c.today,
    tomorrow: c.tomorrow,
    mood: c.mood,
    createdAt: now,
    updatedAt: now,
    tasks: [],
    reminders: [],
  }));

  const gymGoal: Goal = {
    id: "demo-goal-gym",
    title: "Go to the gym",
    unit: "days",
    target: 7,
    current: 3,
    period: "week",
    startDate: makeEntryDate(-2),
    completed: false,
    source: "journal",
    createdAt: now,
    updatedAt: now,
  };

  const readGoal: Goal = {
    id: "demo-goal-read",
    title: "Read",
    unit: "pages",
    target: 100,
    current: 40,
    period: "month",
    startDate: makeEntryDate(-5),
    completed: false,
    source: "manual",
    createdAt: now,
    updatedAt: now,
  };

  // Extra goals whose whole point is to show each is counted in its *own* unit + period:
  // days · pages · sessions · km · hours, across week / month / ongoing.
  const meditateGoal: Goal = {
    id: "demo-goal-meditate",
    title: "Meditate",
    unit: "sessions",
    target: 5,
    current: 2,
    period: "week",
    startDate: makeEntryDate(-1),
    completed: false,
    source: "journal",
    createdAt: now,
    updatedAt: now,
  };

  const runGoal: Goal = {
    id: "demo-goal-run",
    title: "Run",
    unit: "km",
    target: 30,
    current: 12,
    period: "month",
    startDate: makeEntryDate(-6),
    completed: false,
    source: "manual",
    createdAt: now,
    updatedAt: now,
  };

  const guitarGoal: Goal = {
    id: "demo-goal-guitar",
    title: "Practice guitar",
    unit: "hours",
    target: 40,
    current: 9,
    period: "ongoing",
    startDate: makeEntryDate(-10),
    completed: false,
    source: "manual",
    createdAt: now,
    updatedAt: now,
  };

  return {
    tasks: [
      cloneTask(journalTask),
      cloneTask(manualTask),
      cloneTask(tomorrowTask),
      cloneTask(doneTask),
    ],
    reminders: [cloneReminder(reminderToday), cloneReminder(reminderTomorrow)],
    entries: [todayEntry, yesterdayEntry, olderEntry, ...fillerEntries],
    goals: [
      cloneGoal(gymGoal),
      cloneGoal(readGoal),
      cloneGoal(meditateGoal),
      cloneGoal(runGoal),
      cloneGoal(guitarGoal),
    ],
    preferences: { ...DEFAULT_PREFERENCES },
    seedVersion: DEMO_SEED_VERSION,
    seedDay: todayKey(),
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

    // Reseed when the stored blob is from an older seed version or a previous day, so the demo
    // never drifts/staleness-accumulates: every visitor sees the same pristine set anchored to
    // today. Same-day edits (appendDemoJournalEntry) keep the anchor and survive until midnight.
    if (parsed.seedVersion !== DEMO_SEED_VERSION || parsed.seedDay !== todayKey()) {
      const seed = createDemoState();
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }

    return {
      tasks: parsed.tasks.map(cloneTask),
      reminders: parsed.reminders.map(cloneReminder),
      entries: parsed.entries.map(cloneEntry),
      // Backfill goals for blobs saved before this slice existed.
      goals: (parsed.goals ?? []).map(cloneGoal),
      // Backfill preferences for blobs saved before this slice existed.
      preferences: { ...DEFAULT_PREFERENCES, ...(parsed.preferences ?? {}) },
      seedVersion: DEMO_SEED_VERSION,
      seedDay: parsed.seedDay,
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
      progress: 0,
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

    // New goals surfaced by the entry (increment of existing demo goals isn't available
    // server-side in try-mode, so only creation is supported here).
    const newGoals: Goal[] = (parsed.goals ?? []).map((goal) => ({
      id: makeId("demo-goal"),
      title: goal.title,
      unit: goal.unit || "times",
      target: Math.max(1, Math.round(goal.target)),
      current: 0,
      period: goal.period ?? "week",
      startDate: now,
      completed: false,
      source: "journal",
      createdAt: now,
      updatedAt: now,
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
      ...state,
      tasks: [...nestedTasks, ...state.tasks],
      reminders: [...nestedReminders, ...state.reminders],
      entries: [entry, ...state.entries],
      goals: [...newGoals, ...state.goals],
    };
  });
}

// ─── Preferences (demo / unauthenticated) ─────────────────────────────────────

export function loadDemoPreferences(): UserPreferences {
  return loadDemoState().preferences;
}

export function updateDemoPreferences(patch: Partial<UserPreferences>): UserPreferences {
  const next = updateDemoState((state) => ({
    ...state,
    preferences: { ...state.preferences, ...patch },
  }));
  return next.preferences;
}