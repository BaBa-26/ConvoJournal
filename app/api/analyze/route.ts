import { NextRequest, NextResponse } from "next/server";
import { parseJournalEntry } from "@/lib/parser";

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const analysis = parseJournalEntry(content);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json({ error: "Parsing failed" }, { status: 500 });
  }
}
