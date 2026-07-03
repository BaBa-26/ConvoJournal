import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { JournalCreateSchema, validate } from "@/lib/validators";

function safeParseDateOrThrow(s?: string): Date {
  const d = s ? new Date(s) : new Date();
  if (isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get("limit") ?? "30", 10);
    const limit = isNaN(rawLimit) ? 30 : Math.min(Math.max(rawLimit, 1), 100);

    const entries = await prisma.journalEntry.findMany({
      where:   { userId: auth.userId },
      orderBy: { date: "desc" },
      take:    limit,
      include: { tasks: true, reminders: true },
    });

    return NextResponse.json(entries);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[journal GET]", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = validate(JournalCreateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const { rawContent, analysis, date } = parsed.data;

    let entryDate: Date;
    try {
      entryDate = safeParseDateOrThrow(date);
      entryDate.setHours(0, 0, 0, 0);
    } catch {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const entry = await prisma.journalEntry.upsert({
      where:  { userId_date: { userId: auth.userId, date: entryDate } },
      update: {
        rawContent,
        yesterday: analysis?.yesterday ?? null,
        today:     analysis?.today     ?? null,
        tomorrow:  analysis?.tomorrow  ?? null,
        mood:      analysis?.mood      ?? null,
      },
      create: {
        date:      entryDate,
        rawContent,
        yesterday: analysis?.yesterday ?? null,
        today:     analysis?.today     ?? null,
        tomorrow:  analysis?.tomorrow  ?? null,
        mood:      analysis?.mood      ?? null,
        userId:    auth.userId,
      },
    });

    // Create tasks from analysis
    if (analysis?.tasks?.length) {
      await prisma.task.createMany({
        data: analysis.tasks.map((t) => ({
          title:          t.title,
          description:    t.description ?? null,
          dueDate:        t.dueDate ? new Date(t.dueDate) : null,
          priority:       t.priority ?? "medium",
          source:         "journal",
          userId:         auth.userId,
          journalEntryId: entry.id,
        })),
      });
    }

    // Create reminders from analysis
    if (analysis?.reminders?.length) {
      await prisma.reminder.createMany({
        data: analysis.reminders.map((r) => ({
          title:          r.title,
          description:    r.description ?? null,
          eventDate:      new Date(r.eventDate),
          userId:         auth.userId,
          journalEntryId: entry.id,
        })),
      });
    }

    // Create new goals surfaced by the entry
    if (analysis?.goals?.length) {
      await prisma.goal.createMany({
        data: analysis.goals.map((g) => {
          const target = Math.max(1, Math.round(g.target));
          return {
            title:     g.title,
            unit:      g.unit || "times",
            target,
            current:   0,
            period:    g.period ?? "week",
            completed: false,
            source:    "journal",
            userId:    auth.userId,
          };
        }),
      });
    }

    // Apply progress increments against the user's existing goals (ownership re-checked per id)
    if (analysis?.goalUpdates?.length) {
      for (const gu of analysis.goalUpdates) {
        const goal = await prisma.goal.findFirst({ where: { id: gu.goalId, userId: auth.userId } });
        if (!goal) continue;
        const next = Math.min(goal.target, goal.current + Math.max(1, Math.round(gu.increment)));
        await prisma.goal.update({
          where: { id: goal.id },
          data:  { current: next, completed: next >= goal.target },
        });
      }
    }

    const full = await prisma.journalEntry.findUnique({
      where:   { id: entry.id },
      include: { tasks: true, reminders: true },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[journal POST]", error);
    return NextResponse.json({ error: "Failed to save entry" }, { status: 500 });
  }
}
