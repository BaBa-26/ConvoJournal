import { NextRequest, NextResponse } from "next/server";
import { forUser } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ReminderUpdateSchema, validate } from "@/lib/validators";
import { coerceToISO } from "@/lib/dates";

// Verify the reminder belongs to the authenticated user (prevents IDOR). Uses the
// RLS-scoped client so the row is only visible when app.user_id matches.
async function ownedReminder(db: ReturnType<typeof forUser>, id: string, userId: string) {
  return db.reminder.findFirst({ where: { id, userId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const db = forUser(auth.userId);
  const { id } = await params;   // Next 15: route params are async

  try {
    const reminder = await ownedReminder(db, id, auth.userId);
    if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = validate(ReminderUpdateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const updated = await db.reminder.update({
      where: { id },
      data: {
        ...(parsed.data.title       !== undefined && { title:       parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description ?? null }),
        ...(parsed.data.reminded    !== undefined && { reminded:    parsed.data.reminded }),
        ...(parsed.data.eventDate   !== undefined && { eventDate:   new Date(coerceToISO(parsed.data.eventDate) ?? parsed.data.eventDate) }),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[reminders PATCH]", error);
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const db = forUser(auth.userId);
  const { id } = await params;   // Next 15: route params are async

  try {
    const reminder = await ownedReminder(db, id, auth.userId);
    if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.reminder.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[reminders DELETE]", error);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
