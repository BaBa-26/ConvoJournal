import { NextRequest, NextResponse } from "next/server";
import { parseJournalEntry } from "@/lib/parser";
import { AnalyzeSchema, validate } from "@/lib/validators";
import { analyzeWithGemini } from "@/lib/gemini";
import { detectCrisisSignals, mergeRisk, filterCrisisActionables } from "@/lib/crisis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { forUser } from "@/lib/prisma";
import {
  getEntitlements,
  recordUsage,
  hasUsedAnonymousTry,
  markAnonymousTryUsed,
} from "@/lib/entitlements";
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

    const session = await getServerSession(authOptions);

    // Entitlements gate — primary financial risk, so enforced before any AI call.
    if (!session?.user?.id) {
      if (hasUsedAnonymousTry()) {
        return NextResponse.json(
          { error: "signin_required", message: "Sign in to keep going." },
          { status: 401 }
        );
      }
      // Anonymous try-mode: allow this single run; the cookie is set on the response below.
    } else {
      const ent = await getEntitlements(session.user.id);
      if (!ent.canAnalyze) {
        return NextResponse.json(
          { error: "quota_exceeded", plan: ent.plan, used: ent.used, limit: ent.weeklyLimit },
          { status: 402 } // 402 Payment Required — the paywall trigger
        );
      }
    }

    // Optional context: pending task dedup + active goals for authenticated users
    let geminiContext: {
      todayISO: string;
      pendingTaskTitles: string[];
      activeGoals?: { id: string; title: string; unit: string; target: number; current: number }[];
    } = { todayISO, pendingTaskTitles: [] };
    if (session?.user?.id) {
      const db = forUser(session.user.id);
      const [pending, goals] = await Promise.all([
        db.task.findMany({
          where:   { userId: session.user.id, completed: false },
          select:  { title: true },
          orderBy: { createdAt: "desc" },
          take:    25, // recent pending tasks are enough for dedup; caps prompt token cost
        }),
        db.goal.findMany({
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

    // Crisis signal: deterministic layer runs on EVERY path (Gemini or fallback)
    // and merges with the AI's assessment — max level, union of flags. The result
    // is transient (response-only): never persisted, never logged.
    analysis.risk = mergeRisk(detectCrisisSignals(content), analysis.risk);
    if (analysis.risk.level === "none") {
      delete analysis.risk;
    } else {
      // Never let a crisis phrase become a to-do: strip actionables that ARE the
      // crisis phrasing, while keeping the user's real, unrelated tasks/reminders.
      filterCrisisActionables(analysis, content);
    }

    const res = NextResponse.json(analysis);
    // Record usage only after a successful analysis, so failed calls don't consume quota.
    if (session?.user?.id) {
      await recordUsage(session.user.id, "analyze");
    } else {
      markAnonymousTryUsed(res); // burns the one free anonymous run
    }
    return res;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[analyze]", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
