import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TaskUpdateSchema, validate } from "@/lib/validators";

// Verify the task belongs to the authenticated user (prevents IDOR)
async function ownedTask(id: string, userId: string) {
  return prisma.task.findFirst({ where: { id, userId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const task = await ownedTask(params.id, auth.userId);
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = validate(TaskUpdateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const data: {
      completed?: boolean;
      progress?: number;
      title?: string;
      priority?: "high" | "medium" | "low";
      dueDate?: Date | null;
    } = {};

    if (parsed.data.title    !== undefined) data.title    = parsed.data.title;
    if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
    if (parsed.data.dueDate  !== undefined) {
      data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    }

    // Keep `completed` and `progress` in sync.
    // - Completing a task snaps progress to 100.
    // - Dragging progress to 100 marks it complete; below 100 (when not explicitly
    //   completing) marks it incomplete. An explicit `completed` always wins for that flag.
    if (parsed.data.progress !== undefined) {
      data.progress = parsed.data.progress;
      if (parsed.data.completed === undefined) {
        data.completed = parsed.data.progress >= 100;
      }
    }
    if (parsed.data.completed !== undefined) {
      data.completed = parsed.data.completed;
      if (parsed.data.completed && parsed.data.progress === undefined) {
        data.progress = 100;
      }
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[tasks PATCH]", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const task = await ownedTask(params.id, auth.userId);
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.task.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[tasks DELETE]", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
