import { NextRequest, NextResponse } from "next/server";
import { parseJournalEntry } from "@/lib/parser";
import { AnalyzeSchema, validate } from "@/lib/validators";

// Public endpoint — analysis runs locally (no cost), enables try-mode
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = validate(AnalyzeSchema, body);
    if (!parsed.ok) {
      return NextResponse.json(parsed.error, { status: 400 });
    }

    const analysis = parseJournalEntry(parsed.data.content);
    return NextResponse.json(analysis);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[analyze]", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
