import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AnalysisResult } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "30");

    const entries = await prisma.journalEntry.findMany({
      orderBy: { date: "desc" },
      take: limit,
      include: {
        tasks: true,
        reminders: true,
      },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("GET /api/journal error:", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawContent, analysis, date } = body as {
      rawContent: string;
      analysis: AnalysisResult;
      date?: string;
    };

    if (!rawContent) {
      return NextResponse.json({ error: "rawContent is required" }, { status: 400 });
    }

    const entryDate = date ? new Date(date) : new Date();
    // Normalize to start of day
    entryDate.setHours(0, 0, 0, 0);

    const entry = await prisma.journalEntry.upsert({
      where: { date: entryDate },
      update: {
        rawContent,
        yesterday: analysis?.yesterday ?? null,
        today: analysis?.today ?? null,
        tomorrow: analysis?.tomorrow ?? null,
        mood: analysis?.mood ?? null,
      },
      create: {
        date: entryDate,
        rawContent,
        yesterday: analysis?.yesterday ?? null,
        today: analysis?.today ?? null,
        tomorrow: analysis?.tomorrow ?? null,
        mood: analysis?.mood ?? null,
      },
    });

    // Create tasks from analysis
    if (analysis?.tasks?.length) {
      await prisma.task.createMany({
        data: analysis.tasks.map((t) => ({
          title: t.title,
          description: t.description ?? null,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          priority: t.priority ?? "medium",
          source: "journal",
          journalEntryId: entry.id,
        })),
      });
    }

    // Create reminders from analysis
    if (analysis?.reminders?.length) {
      await prisma.reminder.createMany({
        data: analysis.reminders.map((r) => ({
          title: r.title,
          description: r.description ?? null,
          eventDate: new Date(r.eventDate),
          journalEntryId: entry.id,
        })),
      });
    }

    const full = await prisma.journalEntry.findUnique({
      where: { id: entry.id },
      include: { tasks: true, reminders: true },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (error) {
    console.error("POST /api/journal error:", error);
    return NextResponse.json({ error: "Failed to save entry" }, { status: 500 });
  }
}
