import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { GoalUpdateSchema, validate } from "@/lib/validators";

// Verify the goal belongs to the authenticated user (prevents IDOR)
async function ownedGoal(id: string, userId: string) {
  return prisma.goal.findFirst({ where: { id, userId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const goal = await ownedGoal(params.id, auth.userId);
    if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = validate(GoalUpdateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const data: {
      title?: string;
      unit?: string;
      target?: number;
      current?: number;
      period?: "week" | "month" | "ongoing";
      completed?: boolean;
    } = {};

    if (parsed.data.title  !== undefined) data.title  = parsed.data.title;
    if (parsed.data.unit   !== undefined) data.unit   = parsed.data.unit;
    if (parsed.data.period !== undefined) data.period = parsed.data.period;

    // Resolve the final target/current so `completed` stays in sync and current never exceeds target.
    const target  = parsed.data.target  ?? goal.target;
    let   current = parsed.data.current ?? goal.current;
    if (parsed.data.target !== undefined)  data.target  = target;
    current = Math.min(Math.max(current, 0), target);
    if (parsed.data.current !== undefined || parsed.data.target !== undefined) data.current = current;

    if (parsed.data.completed !== undefined) {
      data.completed = parsed.data.completed;
      if (parsed.data.completed && parsed.data.current === undefined) data.current = target;
    } else if (parsed.data.current !== undefined || parsed.data.target !== undefined) {
      data.completed = current >= target;
    }

    const updated = await prisma.goal.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[goals PATCH]", error);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const goal = await ownedGoal(params.id, auth.userId);
    if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.goal.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[goals DELETE]", error);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
