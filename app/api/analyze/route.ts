import { NextRequest, NextResponse } from "next/server";
import { parseJournalEntry } from "@/lib/parser";
import { AnalyzeSchema, validate } from "@/lib/validators";
import { analyzeWithGemini } from "@/lib/gemini";
import { detectCrisisSignals, mergeRisk, filterCrisisActionables } from "@/lib/crisis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { forUser } from "@/lib/prisma";
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

    const { content, timezone, localDate } = v.data;

    // Resolve "today" in the user's local day: prefer the client-sent localDate, else derive
    // from the IANA timezone, else fall back to UTC. This anchors relative-date resolution
    // (both the Gemini prompt and the fallback parser) to the user's calendar day, not UTC.
    const todayISO = localDate
      ? localDate
      : timezone
      ? new Date().toLocaleDateString("sv-SE", { timeZone: timezone })
      : new Date().toISOString().slice(0, 10);

    const session = await getServerSession(authOptions);
    // First name for the single optional direct-address moment (STEP 0b in lib/gemini.ts).
    // Null-safe: dev-credentials / nameless accounts yield undefined → plain second person.
    const firstName = session?.user?.name?.split(" ")[0]?.trim() || undefined;

    // Optional context: pending task dedup + active goals for authenticated users
    let geminiContext: {
      todayISO: string;
      pendingTaskTitles: string[];
      activeGoals?: { id: string; title: string; unit: string; target: number; current: number }[];
      firstName?: string;
    } = { todayISO, pendingTaskTitles: [], firstName };
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
        firstName,
      };
    }

    let analysis: AnalysisResult;
    try {
      analysis = await analyzeWithGemini(content, geminiContext);
    } catch (error) {
      console.error("[analyze] Gemini failed, falling back to regex parser:", error);
      // Give chrono a timezone-corrected reference: noon of the user's local calendar day,
      // so a fallback "tomorrow" at night resolves to the right day (not UTC's day).
      const fallbackNow = new Date(`${todayISO}T12:00:00Z`);
      analysis = parseJournalEntry(content, fallbackNow);
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

    return NextResponse.json(analysis);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[analyze]", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
