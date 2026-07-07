import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/user/export — download all of the caller's data as a JSON file.
// Includes journal entries, tasks, goals, reminders, and safe profile/preference fields.
// Deliberately excludes auth secrets: no Account tokens, no Session rows, no PushSubscription keys.
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const [user, entries, tasks, goals, reminders] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
          onboarded: true,
          displayName: true,
          journalMode: true,
          accentColor: true,
          typeScale: true,
          reminderTime: true,
          timezone: true,
          themeLayout: true,
          colorMode: true,
          widgetOrder: true,
          hiddenWidgets: true,
          backgroundImage: true,
          surfaceStyle: true,
        },
      }),
      prisma.journalEntry.findMany({ where: { userId: auth.userId }, orderBy: { date: "desc" } }),
      prisma.task.findMany({ where: { userId: auth.userId }, orderBy: { createdAt: "desc" } }),
      prisma.goal.findMany({ where: { userId: auth.userId }, orderBy: { createdAt: "desc" } }),
      prisma.reminder.findMany({ where: { userId: auth.userId }, orderBy: { eventDate: "desc" } }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      user,
      entries,
      tasks,
      goals,
      reminders,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="progress-export.json"',
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[user export GET]", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
