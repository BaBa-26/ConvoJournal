import { z } from "zod";

export const TaskCreateSchema = z.object({
  title:       z.string().min(1, "Title required").max(500),
  description: z.string().max(2000).nullish(),
  dueDate:     z.string().datetime({ offset: true }).nullish(),
  priority:    z.enum(["high", "medium", "low"]).default("medium"),
  source:      z.string().max(50).optional(),
});

export const TaskUpdateSchema = z.object({
  title:     z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  priority:  z.enum(["high", "medium", "low"]).optional(),
  dueDate:   z.string().datetime({ offset: true }).nullish().optional(),
});

export const ReminderCreateSchema = z.object({
  title:       z.string().min(1, "Title required").max(500),
  description: z.string().max(2000).nullish(),
  eventDate:   z.string().datetime({ offset: true }),
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
  }).optional(),
});

export const AnalyzeSchema = z.object({
  content:  z.string().min(1, "Content required").max(50_000),
  timezone: z.string().optional(),
});

// Reusable helper — returns parsed data or throws a Response-ready error
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { ok: true; data: T } | { ok: false; error: object } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, error: { error: "Validation failed", details: result.error.flatten() } };
  }
  return { ok: true, data: result.data };
}
