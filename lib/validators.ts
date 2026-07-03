import { z } from "zod";

export const TaskCreateSchema = z.object({
  title:       z.string().min(1, "Title required").max(500),
  description: z.string().max(2000).nullish(),
  dueDate:     z.string().datetime({ offset: true }).nullish(),
  priority:    z.enum(["high", "medium", "low"]).default("medium"),
  source:      z.string().max(50).optional(),
});

export const TaskUpdateSchema = z.object({
  title:       z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullish(),
  completed:   z.boolean().optional(),
  progress:    z.number().int().min(0).max(100).optional(),
  priority:    z.enum(["high", "medium", "low"]).optional(),
  dueDate:     z.string().datetime({ offset: true }).nullish().optional(),
});

export const ReminderCreateSchema = z.object({
  title:       z.string().min(1, "Title required").max(500),
  description: z.string().max(2000).nullish(),
  eventDate:   z.string().datetime({ offset: true }),
});

export const ReminderUpdateSchema = z.object({
  title:       z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullish(),
  reminded:    z.boolean().optional(),
  eventDate:   z.string().datetime({ offset: true }).optional(),
});

export const GoalCreateSchema = z.object({
  title:   z.string().min(1, "Title required").max(200),
  unit:    z.string().min(1).max(30).default("times"),
  target:  z.number().int().min(1).max(100_000),
  current: z.number().int().min(0).max(100_000).optional(),
  period:  z.enum(["week", "month", "ongoing"]).default("week"),
});

export const GoalUpdateSchema = z.object({
  title:     z.string().min(1).max(200).optional(),
  unit:      z.string().min(1).max(30).optional(),
  target:    z.number().int().min(1).max(100_000).optional(),
  current:   z.number().int().min(0).max(100_000).optional(),
  period:    z.enum(["week", "month", "ongoing"]).optional(),
  completed: z.boolean().optional(),
});

export const JournalCreateSchema = z.object({
  rawContent: z.string().min(1, "Content required").max(50_000),
  date:       z.string().datetime({ offset: true }).optional(),
  analysis:   z.object({
    yesterday: z.string().max(5000).optional(),
    today:     z.string().max(5000).optional(),
    tomorrow:  z.string().max(5000).optional(),
    mood:      z.string().max(100).optional(),
    tasks:     z.array(z.object({
      title:       z.string().max(500),
      description: z.string().max(2000).optional(),
      dueDate:     z.string().datetime({ offset: true }).nullish(),
      priority:    z.enum(["high", "medium", "low"]).default("medium"),
    })).optional(),
    reminders: z.array(z.object({
      title:       z.string().max(500),
      description: z.string().max(2000).optional(),
      eventDate:   z.string().datetime({ offset: true }),
    })).optional(),
    goals: z.array(z.object({
      title:  z.string().max(200),
      unit:   z.string().max(30).default("times"),
      target: z.number().int().min(1).max(100_000),
      period: z.enum(["week", "month", "ongoing"]).default("week"),
    })).optional(),
    goalUpdates: z.array(z.object({
      goalId:    z.string().max(50),
      increment: z.number().int().min(1).max(100_000),
    })).optional(),
  }).optional(),
});

const WIDGET_KEY = z.enum(["tonight", "agenda", "stats", "streak", "tomorrow", "recent"]);

export const UserPreferencesUpdateSchema = z.object({
  displayName:   z.string().trim().min(1).max(50).nullish(),
  accentColor:   z.enum(["#c8a878", "#c87a6a", "#7a9a7a", "#6f9bd1", "#b07ab0"]).nullish(),
  typeScale:     z.enum(["sm", "md", "lg"]).optional(),
  reminderTime:  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm").nullish(),
  themeLayout:   z.enum(["daybreak", "hearth", "mosaic"]).optional(),
  colorMode:     z.enum(["light", "dark"]).optional(),
  widgetOrder:   z.array(WIDGET_KEY).max(6).optional(),
  hiddenWidgets: z.array(WIDGET_KEY).max(6).optional(),
  // Either a `preset:<key>` token or an uploaded (downscaled) image data URL. Cap guards abuse.
  backgroundImage: z
    .string()
    .max(3_000_000)
    .regex(/^(preset:[a-z0-9-]{1,32}|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/, "Invalid background")
    .nullish(),
  surfaceStyle:  z.enum(["solid", "translucent"]).optional(),
}).strict();

export const AnalyzeSchema = z.object({
  content:  z.string().min(1, "Content required").max(10_000),  // ~10 min of speech, enough for a journal
  timezone: z.string().max(100).optional(),
});

// Reusable helper — returns parsed data or throws a Response-ready error
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { ok: true; data: T } | { ok: false; error: object } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: { error: "Validation failed", details: result.error.flatten() } };
  }
  return { ok: true, data: result.data };
}
