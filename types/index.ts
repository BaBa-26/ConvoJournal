// ─── Core data shapes ────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;           // API field name
  description?: string | null;
  dueDate?: string | null; // ISO string
  completed: boolean;      // API field name
  completedAt?: string | null; // ISO string — set when completed flips true
  progress: number;        // 0–100; reaches 100 when completed
  priority: "high" | "medium" | "low";
  source: string;
  journalEntryId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string | null;
  eventDate: string; // ISO string
  reminded: boolean;
  journalEntryId?: string | null;
  createdAt: string;
}

export type GoalPeriod = "week" | "month" | "ongoing";

export interface Goal {
  id: string;
  title: string;
  unit: string;         // counting unit: "days" | "sessions" | "times" | "pages" | …
  target: number;       // e.g. 7
  current: number;      // progress toward target
  step: number;         // per-goal default increment the ± buttons apply
  period: GoalPeriod;
  startDate: string;    // ISO string
  completed: boolean;
  completedAt?: string | null; // ISO string — set when completed flips true
  source: string;       // "manual" | "journal"
  createdAt: string;
  updatedAt: string;
}

// A durable record of a finished task/goal — survives the 24h auto-cleanup of the heavy row
// so the weekly momentum bar can still credit cleared wins.
export interface Completion {
  id: string;
  kind: "task" | "goal";
  title: string;
  completedAt: string; // ISO string
}

// Response of GET /api/completions — powers the weekly momentum bar.
export interface CompletionsSummary {
  completedThisWeek: number; // tasks + goals completed since the start of the current week
}

export interface JournalEntry {
  id: string;
  date: string;         // ISO string
  rawContent: string;
  yesterday?: string | null;
  today?: string | null;
  tomorrow?: string | null;
  mood?: string | null;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
  reminders?: Reminder[];
  // Client-only: entry is kept on this device (vault) and never synced to the server.
  // Not a DB column — only set on local/vault entries.
  private?: boolean;
  // Client-only for now: photos/files attached to the entry. Stored on-device
  // (data URLs) until server blob storage is provisioned — see docs/design-system.md §6.11.
  attachments?: Attachment[];
}

// An attached photo or file. Local persistence keeps the (downscaled) content as a
// data URL; the future server contract swaps dataUrl for { url, thumbUrl } from
// POST /api/attachments while the rest of the shape stays identical.
export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;          // bytes (post-processing)
  kind: "image" | "file";
  dataUrl: string;
}

// ─── Parser / AI output shape ─────────────────────────────────────────────────

export interface ParsedEntry {
  yesterday?: string;
  today?: string;
  tomorrow?: string;
  mood?: string;
  tasks: ExtractedTask[];
  reminders: ExtractedReminder[];
  goals?: ExtractedGoal[];        // brand-new goals to create from the entry
  goalUpdates?: GoalUpdate[];     // increments against the user's existing active goals
  // Which analyzer produced this result: Gemini (primary) or the local regex parser
  // (fallback, when Gemini errors). Set server-side, never by the model — UI/telemetry only.
  source?: "gemini" | "fallback";
  // Transient crisis signal (see lib/crisis.ts). Lives only in the in-flight
  // /api/analyze response — never persisted to the DB or localStorage, never logged.
  risk?: import("@/lib/crisis").RiskSignal;
}

export interface ExtractedGoal {
  title: string;
  unit: string;
  target: number;
  period: GoalPeriod;
}

export interface GoalUpdate {
  goalId: string;    // id of an existing active goal
  increment: number; // how much progress the entry adds (in the goal's unit)
}

export interface ExtractedTask {
  title: string;
  description?: string;
  dueDate?: string;       // ISO string
  priority: "high" | "medium" | "low";
}

export interface ExtractedReminder {
  title: string;
  description?: string;
  eventDate: string;      // ISO string
}

// ─── UI-only helpers ──────────────────────────────────────────────────────────

export type RecordingPhase = "idle" | "writing" | "recording" | "analyzing" | "review";
export type TaskFilter = "all" | "pending" | "completed";
export type ActiveTab = "journal" | "tasks" | "reminders";

// Alias for the analysis result (same shape as ParsedEntry)
export type AnalysisResult = ParsedEntry;

// ─── Dashboard personalization ────────────────────────────────────────────────

export type ThemeLayout  = "daybreak" | "hearth" | "mosaic";
export type ColorMode    = "light" | "dark";
export type TypeScale    = "sm" | "md" | "lg";
export type SurfaceStyle = "solid" | "translucent";  // widget card look over a background
export type WidgetKey   = "tonight" | "agenda" | "stats" | "taskprogress" | "goals" | "streak" | "tomorrow" | "recent";

export const WIDGET_KEYS: WidgetKey[] = ["tonight", "agenda", "stats", "taskprogress", "goals", "streak", "tomorrow", "recent"];

// The 5 preset accent swatches from the dashboard design.
export const ACCENT_SWATCHES = ["#c8a878", "#c87a6a", "#7a9a7a", "#6f9bd1", "#b07ab0"] as const;

// Built-in background presets (CSS gradients — zero storage cost). Stored as `preset:<key>`.
export interface BackgroundPreset {
  key: string;
  label: string;
  css: string; // any CSS `background` value
}
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { key: "dusk",    label: "Dusk",    css: "linear-gradient(160deg, #1a1815 0%, #2b1f2e 55%, #3a2438 100%)" },
  { key: "ember",   label: "Ember",   css: "radial-gradient(120% 80% at 70% 10%, #3a241c 0%, #1c1613 55%, #0f0e0b 100%)" },
  { key: "forest",  label: "Forest",  css: "linear-gradient(155deg, #12160f 0%, #1c2a1e 60%, #26382b 100%)" },
  { key: "tide",    label: "Tide",    css: "linear-gradient(160deg, #0f1418 0%, #16242e 55%, #1d3340 100%)" },
  { key: "dawn",    label: "Dawn",    css: "linear-gradient(165deg, #f4ecda 0%, #e9d8c0 55%, #e0c6ba 100%)" },
];

// Maps the type-scale token to the CSS `--type-scale` multiplier (see the mockup's `--sc`).
export const TYPE_SCALE_VALUE: Record<TypeScale, number> = { sm: 0.9, md: 1, lg: 1.12 };

// Where the user's journal data lives. `storageMode` is a per-device choice (localStorage,
// not synced): "sync" = save to the account (cross-device), "local" = keep on this device only.
// `dataMode` is the resolved backing source the app actually reads/writes: "remote" only when
// signed in AND syncing, otherwise "local".
export type StorageMode = "sync" | "local";
export type DataMode = "remote" | "local";

export interface UserPreferences {
  displayName: string | null;
  accentColor: string | null;     // null = fall back to default gold
  typeScale: TypeScale;
  reminderTime: string | null;    // "HH:mm"
  themeLayout: ThemeLayout;
  colorMode: ColorMode;
  widgetOrder: WidgetKey[];
  hiddenWidgets: WidgetKey[];
  backgroundImage: string | null;  // `preset:<key>` token or an uploaded data URL; null = none
  surfaceStyle: SurfaceStyle;      // widget cards: opaque (solid) or blurred glass (translucent)
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  displayName: null,
  accentColor: null,
  typeScale: "md",
  reminderTime: null,
  themeLayout: "daybreak",
  colorMode: "dark",
  widgetOrder: [...WIDGET_KEYS],
  hiddenWidgets: [],
  backgroundImage: null,
  surfaceStyle: "solid",
};

// ─── Derived Today-dashboard shapes (computed in useTodayData) ─────────────────

export interface AgendaItem {
  id: string;
  kind: "reminder" | "task";
  date: string;        // ISO string
  title: string;
  priority?: Task["priority"];
  overdue?: boolean;
}

export interface WeekStats {
  entries: number;
  done: number;
  pending: number;
}

export interface TaskStats extends WeekStats {
  total: number;
  completionPct: number;            // 0–100, rounded
  byPriority: Record<"high" | "medium" | "low", number>; // counts of pending tasks
}

export interface StreakDay {
  date: string;        // yyyy-MM-dd
  hasEntry: boolean;
  level: 0 | 1 | 2 | 3 | 4;         // heatmap intensity bucket
}
