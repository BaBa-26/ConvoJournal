import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Count of tasks + goals the user completed since `since` (ISO, the client's local week start).
// Powers the weekly "momentum" bar: cleared wins keep counting even after the heavy row is
// auto-deleted, because a durable Completion record outlives it. Defaults to the last 7 days.
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const params = new URL(req.url).searchParams;
    const sinceParam = params.get("since");
    const kind = params.get("kind"); // "task" | "goal" | null (both)
    const parsed = sinceParam ? new Date(sinceParam) : null;
    const since = parsed && !isNaN(parsed.getTime())
      ? parsed
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const completedThisWeek = await prisma.completion.count({
      where: {
        userId: auth.userId,
        completedAt: { gte: since },
        ...(kind === "task" || kind === "goal" ? { kind } : {}),
      },
    });

    return NextResponse.json({ completedThisWeek });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[completions GET]", error);
    return NextResponse.json({ error: "Failed to fetch completions" }, { status: 500 });
  }
}
