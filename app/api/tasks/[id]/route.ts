import { NextRequest, NextResponse } from "next/server";
import { forUser } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TaskUpdateSchema, validate } from "@/lib/validators";
import { coerceToISO } from "@/lib/dates";

// Verify the task belongs to the authenticated user (prevents IDOR). Uses the
// RLS-scoped client so the row is only visible when app.user_id matches.
async function ownedTask(db: ReturnType<typeof forUser>, id: string, userId: string) {
  return db.task.findFirst({ where: { id, userId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const db = forUser(auth.userId);
  const { id } = await params;   // Next 15: route params are async

  try {
    const task = await ownedTask(db, id, auth.userId);
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = validate(TaskUpdateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const data: {
      completed?: boolean;
      completedAt?: Date | null;
      progress?: number;
      title?: string;
      description?: string | null;
      priority?: "high" | "medium" | "low";
      dueDate?: Date | null;
    } = {};

    if (parsed.data.title       !== undefined) data.title       = parsed.data.title;
    if (parsed.data.description !== undefined) data.description = parsed.data.description ?? null;
    if (parsed.data.priority    !== undefined) data.priority    = parsed.data.priority;
    if (parsed.data.dueDate  !== undefined) {
      const iso = coerceToISO(parsed.data.dueDate);
      data.dueDate = iso ? new Date(iso) : null;
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

    // Detect a completion transition so we can stamp `completedAt` (drives 24h cleanup)
    // and record a durable `Completion` (survives the cleanup so momentum keeps the win).
    const willComplete = data.completed !== undefined ? data.completed : task.completed;
    const transitioned = willComplete !== task.completed;
    if (transitioned) data.completedAt = willComplete ? new Date() : null;

    const updated = await db.task.update({ where: { id }, data });

    if (transitioned) {
      if (willComplete) {
        await db.completion.create({
          data: { kind: "task", title: updated.title, completedAt: updated.completedAt ?? new Date(), userId: auth.userId },
        });
      } else {
        // Toggled back to incomplete — drop the most recent matching completion so counts don't inflate.
        const latest = await db.completion.findFirst({
          where: { userId: auth.userId, kind: "task", title: updated.title },
          orderBy: { completedAt: "desc" },
        });
        if (latest) await db.completion.delete({ where: { id: latest.id } });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[tasks PATCH]", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const db = forUser(auth.userId);
  const { id } = await params;   // Next 15: route params are async

  try {
    const task = await ownedTask(db, id, auth.userId);
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[tasks DELETE]", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
