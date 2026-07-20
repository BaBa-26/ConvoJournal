import { NextRequest, NextResponse } from "next/server";
import { forUser } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TaskCreateSchema, validate } from "@/lib/validators";
import { coerceToISO } from "@/lib/dates";
import { COMPLETED_HIDE_MS } from "@/lib/completed";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const db = forUser(auth.userId);

  try {
    const tasks = await db.task.findMany({
      where:   { userId: auth.userId },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
    // Every task (incl. long-completed ones — the archive keeps them) plus the server-authoritative
    // cutoff for the 24h active-view hide, so the client filters against server time (no 2nd call,
    // no client-clock skew). Rows are NEVER filtered out here — hiding is a per-surface view concern.
    const cutoff = new Date(Date.now() - COMPLETED_HIDE_MS).toISOString();
    return NextResponse.json(tasks, { headers: { "x-completed-cutoff": cutoff } });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[tasks GET]", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const db = forUser(auth.userId);

  try {
    const body = await req.json();
    const parsed = validate(TaskCreateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const task = await db.task.create({
      data: {
        title:       parsed.data.title,
        description: parsed.data.description ?? null,
        dueDate:     coerceToISO(parsed.data.dueDate),
        priority:    parsed.data.priority,
        source:      "manual",
        userId:      auth.userId,
      },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[tasks POST]", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
