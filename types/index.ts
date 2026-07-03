// ─── Core data shapes ────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;           // API field name
  description?: string | null;
  dueDate?: string | null; // ISO string
  completed: boolean;      // API field name
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
  period: GoalPeriod;
  startDate: string;    // ISO string
  completed: boolean;
  source: string;       // "manual" | "journal"
  createdAt: string;
  updatedAt: string;
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
export type WidgetKey   = "tonight" | "agenda" | "stats" | "streak" | "tomorrow" | "recent";

export const WIDGET_KEYS: WidgetKey[] = ["tonight", "agenda", "stats", "streak", "tomorrow", "recent"];

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
