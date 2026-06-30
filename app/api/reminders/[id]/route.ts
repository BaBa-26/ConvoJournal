import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ReminderUpdateSchema, validate } from "@/lib/validators";

// Verify the reminder belongs to the authenticated user (prevents IDOR)
async function ownedReminder(id: string, userId: string) {
  return prisma.reminder.findFirst({ where: { id, userId } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const reminder = await ownedReminder(params.id, auth.userId);
    if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = validate(ReminderUpdateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    const updated = await prisma.reminder.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.title     !== undefined && { title:     parsed.data.title }),
        ...(parsed.data.reminded  !== undefined && { reminded:  parsed.data.reminded }),
        ...(parsed.data.eventDate !== undefined && { eventDate: new Date(parsed.data.eventDate) }),
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
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const reminder = await ownedReminder(params.id, auth.userId);
    if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.reminder.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[reminders DELETE]", error);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
