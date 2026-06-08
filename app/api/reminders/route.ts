import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const reminders = await prisma.reminder.findMany({
      orderBy: { eventDate: "asc" },
    });
    return NextResponse.json(reminders);
  } catch (error) {
    console.error("GET /api/reminders error:", error);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const reminder = await prisma.reminder.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        eventDate: new Date(body.eventDate),
      },
    });
    return NextResponse.json(reminder, { status: 201 });
  } catch (error) {
    console.error("POST /api/reminders error:", error);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}
