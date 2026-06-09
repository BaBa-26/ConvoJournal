import * as chrono from "chrono-node";
import type { AnalysisResult, ExtractedTask, ExtractedReminder } from "@/types";

// Phrases that signal a task the user needs to do
const TASK_TRIGGERS = [
  /\b(?:need to|needs to|gotta|got to|have to|has to|must|should|want to|going to|planning to|plan to)\s+(.+?)(?:[.,!?]|$)/gi,
  /\b(?:don't forget|do not forget|remember to|make sure to|make sure I)\s+(.+?)(?:[.,!?]|$)/gi,
  /\b(?:todo|to-do|task):\s*(.+?)(?:[.,!?]|$)/gi,
];

// Phrases that signal a calendar event / reminder
const EVENT_TRIGGERS = [
  /\b(?:meeting|call|appointment|interview|doctor|dentist|lunch|dinner|breakfast|event|party|wedding|birthday|deadline|due date|flight|trip)\b.{0,60}/gi,
  /\b(?:i have|we have|there is|there's)\s+(?:a|an|the)?\s*(?:meeting|call|appointment|interview|event).{0,60}/gi,
];

// Section boundary keywords
const YESTERDAY_KW = /\b(yesterday|last night|last week|earlier this week|the other day)\b/i;
const TODAY_KW = /\b(today|this morning|this afternoon|this evening|right now|currently|at the moment)\b/i;
const TOMORROW_KW = /\b(tomorrow|next week|next month|upcoming|soon|later this week|this weekend)\b/i;

function splitSections(text: string): { yesterday: string; today: string; tomorrow: string } {
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) ?? [text];

  const buckets: { yesterday: string[]; today: string[]; tomorrow: string[] } = {
    yesterday: [],
    today: [],
    tomorrow: [],
  };

  // Simple heuristic: assign each sentence to a bucket based on keyword presence.
  // If no keyword found, assign to "today" as default.
  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if (YESTERDAY_KW.test(s)) {
      buckets.yesterday.push(s);
    } else if (TOMORROW_KW.test(s)) {
      buckets.tomorrow.push(s);
    } else {
      buckets.today.push(s);
    }
  }

  return {
    yesterday: buckets.yesterday.join(" ").trim(),
    today: buckets.today.join(" ").trim(),
    tomorrow: buckets.tomorrow.join(" ").trim(),
  };
}

function extractTasks(text: string): ExtractedTask[] {
  const tasks: ExtractedTask[] = [];
  const seen = new Set<string>();

  for (const pattern of TASK_TRIGGERS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[1]?.trim();
      if (!raw || raw.length < 3 || raw.length > 120) continue;

      const title = capitalize(raw.replace(/\s+/g, " "));
      if (seen.has(title.toLowerCase())) continue;
      seen.add(title.toLowerCase());

      // Try to parse a due date from the surrounding context (±50 chars)
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.slice(start, end);
      const parsed = chrono.parseDate(context, new Date(), { forwardDate: true });

      // Detect priority keywords
      let priority: "high" | "medium" | "low" = "medium";
      if (/\b(urgent|asap|immediately|critical|important)\b/i.test(context)) priority = "high";
      else if (/\b(whenever|eventually|someday|low priority)\b/i.test(context)) priority = "low";

      tasks.push({
        title,
        dueDate: parsed ? parsed.toISOString() : undefined,
        priority,
      });
    }
  }

  return tasks;
}

function extractReminders(text: string, tasks: ExtractedTask[]): ExtractedReminder[] {
  const reminders: ExtractedReminder[] = [];
  const seen = new Set<string>();

  // Use chrono to find all date/time mentions in the text
  const chronoResults = chrono.parse(text, new Date(), { forwardDate: true });

  for (const result of chronoResults) {
    const eventDate = result.date();
    if (!eventDate) continue;

    // Grab surrounding text as the reminder title (up to 80 chars before/after)
    const start = Math.max(0, result.index - 80);
    const end = Math.min(text.length, result.index + result.text.length + 80);
    const context = text.slice(start, end).trim();

    // Check if this context matches an event pattern
    let title = "";
    for (const pattern of EVENT_TRIGGERS) {
      pattern.lastIndex = 0;
      const m = pattern.exec(context);
      if (m) {
        title = m[0].replace(result.text, "").replace(/\s+/g, " ").trim();
        title = capitalize(title.replace(/^(i have|we have|there is|there's)\s+/i, ""));
        break;
      }
    }

    if (!title) {
      // Fall back: use the sentence containing the date
      const sentence = context.split(/[.!?\n]/)[0]?.trim() ?? "";
      title = capitalize(sentence.replace(result.text, "").trim().slice(0, 80));
    }

    if (!title || title.length < 3) continue;
    const key = `${title.toLowerCase()}-${eventDate.toDateString()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Skip if already captured as a task with the same date
    const alreadyTask = tasks.some(
      (t) => t.dueDate && new Date(t.dueDate).toDateString() === eventDate.toDateString()
    );
    if (alreadyTask) continue;

    reminders.push({ title, eventDate: eventDate.toISOString() });
  }

  return reminders;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function parseJournalEntry(text: string): AnalysisResult {
  const sections = splitSections(text);
  const tasks = extractTasks(text);
  const reminders = extractReminders(text, tasks);

  return {
    yesterday: sections.yesterday || undefined,
    today: sections.today || undefined,
    tomorrow: sections.tomorrow || undefined,
    tasks,
    reminders,
  };
}
