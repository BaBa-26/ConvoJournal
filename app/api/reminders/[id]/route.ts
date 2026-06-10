import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const reminder = await prisma.reminder.update({
      where: { id: params.id },
      data: {
        ...(body.title     !== undefined && { title: body.title }),
        ...(body.reminded  !== undefined && { reminded: body.reminded }),
        ...(body.eventDate !== undefined && { eventDate: new Date(body.eventDate) }),
      },
    });
    return NextResponse.json(reminder);
  } catch (error) {
    console.error("PATCH /api/reminders/[id] error:", error);
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.reminder.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/reminders/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
