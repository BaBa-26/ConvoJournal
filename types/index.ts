// ─── Core data shapes ────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;           // API field name
  description?: string | null;
  dueDate?: string | null; // ISO string
  completed: boolean;      // API field name
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

export type RecordingPhase = "idle" | "recording" | "analyzing" | "review";
export type TaskFilter = "all" | "pending" | "completed";
export type ActiveTab = "journal" | "tasks" | "reminders";

// Alias for the analysis result (same shape as ParsedEntry)
export type AnalysisResult = ParsedEntry;
