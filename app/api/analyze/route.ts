import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import type { AnalysisResult } from "@/types";

const SYSTEM_PROMPT = `You are a journal analysis assistant. Given a free-form journal entry, extract and structure the content.

The user may speak about:
- Yesterday: what happened the day before
- Today: current day activities, feelings, plans
- Tomorrow/Upcoming: future plans, events, or intentions

Also extract:
- Tasks: action items the user needs to do (assign priority: high/medium/low, and dueDate in ISO format if mentioned)
- Reminders: specific future events with dates (eventDate in ISO format is REQUIRED - infer the nearest plausible date if not exact)
- Mood: single word describing overall tone (e.g. "happy", "stressed", "reflective", "energetic")

Today's date for reference: ${new Date().toISOString().split("T")[0]}

Respond ONLY with valid JSON matching this schema:
{
  "yesterday": "string or null",
  "today": "string or null",
  "tomorrow": "string or null",
  "mood": "string or null",
  "tasks": [{ "title": "string", "description": "string|null", "dueDate": "ISO date string|null", "priority": "high|medium|low" }],
  "reminders": [{ "title": "string", "description": "string|null", "eventDate": "ISO date string" }]
}`;

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Journal entry:\n\n${content}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const analysis: AnalysisResult = JSON.parse(raw);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
