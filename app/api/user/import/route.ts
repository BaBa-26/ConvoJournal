import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { UserImportSchema, validate } from "@/lib/validators";

// Normalize an entry date to local midnight so it collapses onto the one-entry-per-day model
// (matches the {userId, date} upsert used by /api/journal). Returns null for unparseable dates.
function midnight(s?: string | null): Date | null {
  const d = s ? new Date(s) : new Date();
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function safeDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// POST /api/user/import — bulk-import a user's on-device (try-mode / vault) data into their
// account. Used when a local user turns on cloud sync. Everything is scoped to the caller's
// userId; unparseable dates are dropped rather than 400-ing the whole batch.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = validate(UserImportSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const userId = auth.userId;
    const entries = parsed.data.entries ?? [];
    const standaloneTasks = parsed.data.tasks ?? [];
    const standaloneReminders = parsed.data.reminders ?? [];
    const goals = parsed.data.goals ?? [];

    const counts = { entries: 0, tasks: 0, reminders: 0, goals: 0 };

    await prisma.$transaction(async (tx) => {
      // Journal entries + their nested (journal-sourced) tasks/reminders.
      for (const e of entries) {
        const date = midnight(e.date);
        if (!date) continue;

        const entry = await tx.journalEntry.upsert({
          where: { userId_date: { userId, date } },
          update: {
            rawContent: e.rawContent,
            yesterday: e.yesterday ?? null,
            today: e.today ?? null,
            tomorrow: e.tomorrow ?? null,
            mood: e.mood ?? null,
          },
          create: {
            userId,
            date,
            rawContent: e.rawContent,
            yesterday: e.yesterday ?? null,
            today: e.today ?? null,
            tomorrow: e.tomorrow ?? null,
            mood: e.mood ?? null,
          },
        });
        counts.entries++;

        if (e.tasks?.length) {
          await tx.task.createMany({
            data: e.tasks.map((t) => ({
              title: t.title,
              description: t.description ?? null,
              dueDate: safeDate(t.dueDate),
              priority: t.priority,
              source: "journal",
              userId,
              journalEntryId: entry.id,
            })),
          });
          counts.tasks += e.tasks.length;
        }

        if (e.reminders?.length) {
          const rows = e.reminders
            .map((r) => ({ r, d: safeDate(r.eventDate) }))
            .filter((x): x is { r: (typeof e.reminders)[number]; d: Date } => x.d !== null);
          if (rows.length) {
            await tx.reminder.createMany({
              data: rows.map(({ r, d }) => ({
                title: r.title,
                description: r.description ?? null,
                eventDate: d,
                userId,
                journalEntryId: entry.id,
              })),
            });
            counts.reminders += rows.length;
          }
        }
      }

      // Standalone (manually created) tasks — no journal link.
      if (standaloneTasks.length) {
        await tx.task.createMany({
          data: standaloneTasks.map((t) => ({
            title: t.title,
            description: t.description ?? null,
            dueDate: safeDate(t.dueDate),
            priority: t.priority,
            source: "manual",
            userId,
          })),
        });
        counts.tasks += standaloneTasks.length;
      }

      // Standalone reminders.
      const remRows = standaloneReminders
        .map((r) => ({ r, d: safeDate(r.eventDate) }))
        .filter((x): x is { r: (typeof standaloneReminders)[number]; d: Date } => x.d !== null);
      if (remRows.length) {
        await tx.reminder.createMany({
          data: remRows.map(({ r, d }) => ({
            title: r.title,
            description: r.description ?? null,
            eventDate: d,
            userId,
          })),
        });
        counts.reminders += remRows.length;
      }

      // Goals.
      if (goals.length) {
        await tx.goal.createMany({
          data: goals.map((g) => {
            const target = Math.max(1, Math.round(g.target));
            const current = Math.min(target, Math.max(0, Math.round(g.current)));
            return {
              title: g.title,
              unit: g.unit || "times",
              target,
              current,
              period: g.period,
              completed: current >= target,
              source: "manual",
              userId,
            };
          }),
        });
        counts.goals += goals.length;
      }
    });

    return NextResponse.json({ ok: true, counts }, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[user import POST]", error);
    return NextResponse.json({ error: "Failed to import data" }, { status: 500 });
  }
}
