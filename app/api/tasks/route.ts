import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TaskCreateSchema, validate } from "@/lib/validators";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const tasks = await prisma.task.findMany({
      where:   { userId: auth.userId },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(tasks);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[tasks GET]", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = validate(TaskCreateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const task = await prisma.task.create({
      data: {
        title:       parsed.data.title,
        description: parsed.data.description ?? null,
        dueDate:     parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
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
