import { NextRequest, NextResponse } from "next/server";
import { parseJournalEntry } from "@/lib/parser";
import { AnalyzeSchema, validate } from "@/lib/validators";
import { analyzeWithGemini } from "@/lib/gemini";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AnalysisResult } from "@/types";

// Public endpoint — try-mode works unauthenticated; auth unlocks task dedup context
export async function POST(req: NextRequest) {
  // Reject oversized bodies before parsing — fast path, no AI call made
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 15_000) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  try {
    const body = await req.json();
    const v = validate(AnalyzeSchema, body);
    if (!v.ok) return NextResponse.json(v.error, { status: 400 });

    const { content, timezone } = v.data;

    // Resolve "today" in the user's local timezone, not UTC
    const todayISO = timezone
      ? new Date().toLocaleDateString("sv-SE", { timeZone: timezone })
      : new Date().toISOString().slice(0, 10);

    // Optional context: pending task dedup + active goals for authenticated users
    let geminiContext: {
      todayISO: string;
      pendingTaskTitles: string[];
      activeGoals?: { id: string; title: string; unit: string; target: number; current: number }[];
    } = { todayISO, pendingTaskTitles: [] };
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const [pending, goals] = await Promise.all([
        prisma.task.findMany({
          where:   { userId: session.user.id, completed: false },
          select:  { title: true },
          orderBy: { createdAt: "desc" },
          take:    25, // recent pending tasks are enough for dedup; caps prompt token cost
        }),
        prisma.goal.findMany({
          where:   { userId: session.user.id, completed: false },
          select:  { id: true, title: true, unit: true, target: true, current: true },
          orderBy: { createdAt: "desc" },
          take:    20,
        }),
      ]);
      geminiContext = {
        todayISO,
        pendingTaskTitles: pending.map((t) => t.title),
        activeGoals: goals,
      };
    }

    let analysis: AnalysisResult;
    try {
      analysis = await analyzeWithGemini(content, geminiContext);
    } catch (error) {
      console.error("[analyze] Gemini failed, falling back to regex parser:", error);
      analysis = parseJournalEntry(content);
    }

    return NextResponse.json(analysis);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[analyze]", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
