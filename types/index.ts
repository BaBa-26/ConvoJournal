export interface JournalEntry {
  id: string;
  date: string;
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

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  completed: boolean;
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
  eventDate: string;
  reminded: boolean;
  journalEntryId?: string | null;
  createdAt: string;
}

export interface AnalysisResult {
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
  dueDate?: string;
  priority: "high" | "medium" | "low";
}

export interface ExtractedReminder {
  title: string;
  description?: string;
  eventDate: string;
}
