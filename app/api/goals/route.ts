import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { GoalCreateSchema, validate } from "@/lib/validators";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const goals = await prisma.goal.findMany({
      where:   { userId: auth.userId },
      orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(goals);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[goals GET]", error);
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = validate(GoalCreateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const { title, unit, target, current, period } = parsed.data;
    const cur = Math.min(current ?? 0, target);

    const goal = await prisma.goal.create({
      data: {
        title,
        unit,
        target,
        current:   cur,
        period,
        completed: cur >= target,
        source:    "manual",
        userId:    auth.userId,
      },
    });
    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[goals POST]", error);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}
