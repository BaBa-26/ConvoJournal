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

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.completed !== undefined && { completed: parsed.data.completed }),
        ...(parsed.data.title     !== undefined && { title:     parsed.data.title     }),
        ...(parsed.data.priority  !== undefined && { priority:  parsed.data.priority  }),
        ...(parsed.data.dueDate   !== undefined && {
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        }),
      },
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
