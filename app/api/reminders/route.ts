import { NextRequest, NextResponse } from "next/server";
import { forUser } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ReminderCreateSchema, validate } from "@/lib/validators";
import { coerceToISO } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const db = forUser(auth.userId);

  try {
    const reminders = await db.reminder.findMany({
      where:   { userId: auth.userId },
      orderBy: { eventDate: "asc" },
    });
    return NextResponse.json(reminders);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[reminders GET]", error);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const db = forUser(auth.userId);

  try {
    const body = await req.json();
    const parsed = validate(ReminderCreateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const reminder = await db.reminder.create({
      data: {
        title:       parsed.data.title,
        description: parsed.data.description ?? null,
        // dateInput guarantees a parseable value; coerceToISO normalizes a bare YYYY-MM-DD to noon.
        eventDate:   new Date(coerceToISO(parsed.data.eventDate) ?? parsed.data.eventDate),
        userId:      auth.userId,
      },
    });
    return NextResponse.json(reminder, { status: 201 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[reminders POST]", error);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
