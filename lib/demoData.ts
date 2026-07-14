import type { Goal, JournalEntry, ParsedEntry, Reminder, Task, UserPreferences, GoalPeriod } from "@/types";
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

// Ephemeral signed-out try-mode store (reseeds daily — preserves the clean-start funnel).
export const DEMO_STORAGE_KEY = "progress-demo-state-v1";
// Persistent local vault for signed-in users who turn cloud sync OFF. Same shape, but it
// holds the user's *real* data, so it must NEVER reseed/wipe (see loadStateFromKey).
export const VAULT_STORAGE_KEY = "progress:localVault";

// Bump to force every device back to a fresh seed after the seed content changes.
// v5 = clean-start funnel: signed-out visitors begin empty (no preloaded sample content).
export const DEMO_SEED_VERSION = 5;

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
  // Clean start: brand-new signed-out visitors begin with an empty app. They see the
  // friendly empty states, and their first recorded entry is genuinely theirs — persisted
  // on sign-in via the pending-entry migration, not seeded as fake sample content.
  return {
    tasks: [],
    reminders: [],
    entries: [],
    goals: [],
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

function normalizeState(parsed: DemoState): DemoState {
  return {
    tasks: parsed.tasks.map(cloneTask),
    reminders: parsed.reminders.map(cloneReminder),
    entries: parsed.entries.map(cloneEntry),
    // Backfill goals for blobs saved before this slice existed.
    goals: (parsed.goals ?? []).map(cloneGoal),
    // Backfill preferences for blobs saved before this slice existed.
    preferences: { ...DEFAULT_PREFERENCES, ...(parsed.preferences ?? {}) },
    seedVersion: DEMO_SEED_VERSION,
    seedDay: parsed.seedDay ?? todayKey(),
  };
}

// ─── Key-generic persistence core ─────────────────────────────────────────────
// `reseed` = true for the ephemeral demo store (wipe on day/version rollover), false for the
// persistent local vault (real data must survive midnight & version bumps).
export function loadStateFromKey(key: string, reseed: boolean): DemoState {
  if (typeof window === "undefined") return createDemoState();

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const seed = createDemoState();
      window.localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }

    const parsed = JSON.parse(raw);
    if (!isDemoState(parsed)) {
      const seed = createDemoState();
      window.localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }

    // Reseed only the demo store when its blob is from an older seed version or a previous day,
    // so the try-mode demo never drifts. The vault is exempt: it holds real data.
    if (reseed && (parsed.seedVersion !== DEMO_SEED_VERSION || parsed.seedDay !== todayKey())) {
      const seed = createDemoState();
      window.localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }

    return normalizeState(parsed);
  } catch {
    const seed = createDemoState();
    try {
      window.localStorage.setItem(key, JSON.stringify(seed));
    } catch {}
    return seed;
  }
}

export function saveStateToKey(key: string, state: DemoState): DemoState {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(state));
  }
  return state;
}

export function updateStateAtKey(
  key: string,
  reseed: boolean,
  updater: (state: DemoState) => DemoState
): DemoState {
  return saveStateToKey(key, updater(loadStateFromKey(key, reseed)));
}

// ─── Demo (signed-out try mode) public API — unchanged call sites ─────────────
export function loadDemoState(): DemoState {
  return loadStateFromKey(DEMO_STORAGE_KEY, true);
}

export function saveDemoState(state: DemoState): DemoState {
  return saveStateToKey(DEMO_STORAGE_KEY, state);
}

export function resetDemoState(): DemoState {
  return saveDemoState(createDemoState());
}

export function updateDemoState(updater: (state: DemoState) => DemoState): DemoState {
  return updateStateAtKey(DEMO_STORAGE_KEY, true, updater);
}

function toJournalText(parsed: ParsedEntry, rawContent: string): string {
  return [parsed.yesterday, parsed.today, parsed.tomorrow, rawContent]
    .filter(Boolean)
    .join(" ");
}

// Pure reducer: return the next state with `parsed` appended as a new entry (+ its tasks/
// reminders/goals). Shared by the demo store and the persistent vault. `isPrivate` marks the
// entry device-only (used in sync mode to keep a single entry off the server).
export function withAppendedEntry(
  state: DemoState,
  rawContent: string,
  parsed: ParsedEntry,
  isPrivate = false,
  attachments: JournalEntry["attachments"] = undefined
): DemoState {
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

  // New goals surfaced by the entry (increment of existing goals isn't available in local
  // mode, so only creation is supported here).
  const newGoals: Goal[] = (parsed.goals ?? []).map((goal) => ({
    id: makeId("demo-goal"),
    title: goal.title,
    unit: goal.unit || "times",
    target: Math.max(1, Math.round(goal.target)),
    current: 0,
    step: 1,
    period: goal.period ?? "week",
    startDate: now,
    completed: false,
    completedAt: null,
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
    private: isPrivate,
    ...(attachments?.length ? { attachments } : {}),
  };

  return {
    ...state,
    tasks: [...nestedTasks, ...state.tasks],
    reminders: [...nestedReminders, ...state.reminders],
    entries: [entry, ...state.entries],
    goals: [...newGoals, ...state.goals],
  };
}

export function appendDemoJournalEntry(rawContent: string, parsed: ParsedEntry): DemoState {
  return updateDemoState((state) => withAppendedEntry(state, rawContent, parsed));
}

// ─── Migration helpers (local ⇆ account) ──────────────────────────────────────

export function demoStateIsEmpty(state: DemoState): boolean {
  return (
    state.entries.length === 0 &&
    state.tasks.length === 0 &&
    state.reminders.length === 0 &&
    state.goals.length === 0
  );
}

interface ImportTaskDTO {
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: "high" | "medium" | "low";
}
interface ImportReminderDTO {
  title: string;
  description: string | null;
  eventDate: string;
}
export interface ImportPayload {
  entries: Array<{
    date: string;
    rawContent: string;
    yesterday: string | null;
    today: string | null;
    tomorrow: string | null;
    mood: string | null;
    tasks: ImportTaskDTO[];
    reminders: ImportReminderDTO[];
  }>;
  tasks: ImportTaskDTO[];
  reminders: ImportReminderDTO[];
  goals: Array<{ title: string; unit: string; target: number; current: number; period: GoalPeriod }>;
}

// Flatten a local DemoState into the /api/user/import payload. Entries carry their own nested
// journal-created tasks/reminders; the top-level tasks/reminders lists send only the *standalone*
// (manually created) ones — those with no journalEntryId — so nothing is double-created.
export function demoStateToImportPayload(state: DemoState): ImportPayload {
  return {
    entries: state.entries.map((e) => ({
      date: e.date,
      rawContent: e.rawContent || e.today || e.yesterday || e.tomorrow || "—",
      yesterday: e.yesterday ?? null,
      today: e.today ?? null,
      tomorrow: e.tomorrow ?? null,
      mood: e.mood ?? null,
      tasks: (e.tasks ?? []).map((t) => ({
        title: t.title,
        description: t.description ?? null,
        dueDate: t.dueDate ?? null,
        priority: t.priority,
      })),
      reminders: (e.reminders ?? []).map((r) => ({
        title: r.title,
        description: r.description ?? null,
        eventDate: r.eventDate,
      })),
    })),
    tasks: state.tasks
      .filter((t) => !t.journalEntryId)
      .map((t) => ({
        title: t.title,
        description: t.description ?? null,
        dueDate: t.dueDate ?? null,
        priority: t.priority,
      })),
    reminders: state.reminders
      .filter((r) => !r.journalEntryId)
      .map((r) => ({ title: r.title, description: r.description ?? null, eventDate: r.eventDate })),
    goals: state.goals.map((g) => ({
      title: g.title,
      unit: g.unit,
      target: g.target,
      current: g.current,
      period: g.period,
    })),
  };
}

// Rebuild a DemoState from an /api/user/export payload (flat tables) — used when a user turns
// cloud sync OFF and we download their account into the local vault. Tasks/reminders are
// re-nested into their originating entries by journalEntryId for the journal-history view.
export function exportToState(payload: {
  entries?: JournalEntry[];
  tasks?: Task[];
  reminders?: Reminder[];
  goals?: Goal[];
}): DemoState {
  const tasks = (payload.tasks ?? []).map(cloneTask);
  const reminders = (payload.reminders ?? []).map(cloneReminder);
  const tasksByEntry = new Map<string, Task[]>();
  const remsByEntry = new Map<string, Reminder[]>();
  for (const t of tasks) {
    if (!t.journalEntryId) continue;
    const list = tasksByEntry.get(t.journalEntryId) ?? [];
    list.push(t);
    tasksByEntry.set(t.journalEntryId, list);
  }
  for (const r of reminders) {
    if (!r.journalEntryId) continue;
    const list = remsByEntry.get(r.journalEntryId) ?? [];
    list.push(r);
    remsByEntry.set(r.journalEntryId, list);
  }

  const entries = (payload.entries ?? []).map((e) => ({
    ...cloneEntry(e),
    tasks: tasksByEntry.get(e.id) ?? [],
    reminders: remsByEntry.get(e.id) ?? [],
  }));

  return {
    tasks,
    reminders,
    entries,
    goals: (payload.goals ?? []).map(cloneGoal),
    preferences: { ...DEFAULT_PREFERENCES },
    seedVersion: DEMO_SEED_VERSION,
    seedDay: todayKey(),
  };
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
