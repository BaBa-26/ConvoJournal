import { NextRequest, NextResponse } from "next/server";
import { forUser } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { GoalUpdateSchema, validate } from "@/lib/validators";

// Verify the goal belongs to the authenticated user (prevents IDOR). Uses the
// RLS-scoped client so the row is only visible when app.user_id matches.
async function ownedGoal(db: ReturnType<typeof forUser>, id: string, userId: string) {
  return db.goal.findFirst({ where: { id, userId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const db = forUser(auth.userId);

  try {
    const goal = await ownedGoal(db, params.id, auth.userId);
    if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = validate(GoalUpdateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const data: {
      title?: string;
      unit?: string;
      target?: number;
      current?: number;
      step?: number;
      period?: "week" | "month" | "ongoing";
      completed?: boolean;
      completedAt?: Date | null;
    } = {};

    if (parsed.data.title  !== undefined) data.title  = parsed.data.title;
    if (parsed.data.unit   !== undefined) data.unit   = parsed.data.unit;
    if (parsed.data.step   !== undefined) data.step   = parsed.data.step;
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

    // Stamp `completedAt` on a completion transition + record a durable `Completion`
    // (survives the 24h cleanup so the weekly momentum bar keeps crediting the win).
    const willComplete = data.completed !== undefined ? data.completed : goal.completed;
    const transitioned = willComplete !== goal.completed;
    if (transitioned) data.completedAt = willComplete ? new Date() : null;

    const updated = await db.goal.update({ where: { id: params.id }, data });

    if (transitioned) {
      if (willComplete) {
        await db.completion.create({
          data: { kind: "goal", title: updated.title, completedAt: updated.completedAt ?? new Date(), userId: auth.userId },
        });
      } else {
        const latest = await db.completion.findFirst({
          where: { userId: auth.userId, kind: "goal", title: updated.title },
          orderBy: { completedAt: "desc" },
        });
        if (latest) await db.completion.delete({ where: { id: latest.id } });
      }
    }

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
  const db = forUser(auth.userId);

  try {
    const goal = await ownedGoal(db, params.id, auth.userId);
    if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.goal.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[goals DELETE]", error);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
