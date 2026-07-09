import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// DELETE /api/user/data — erase the caller's journal data (entries, tasks, reminders, goals)
// from the server WITHOUT deleting their account, session, or preferences. This is the
// "delete my synced copy from the server" control: a local-only user can wipe the cloud copy
// on purpose while staying signed in and continuing to journal on-device.
export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const userId = auth.userId;
    // Order: children before entries (tasks/reminders reference journalEntryId). Goals stand alone.
    // set_config makes app.user_id visible to the RLS policies for the whole transaction, so the
    // deletes actually match rows (without it, current_setting is NULL → RLS filters everything out).
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      await tx.task.deleteMany({ where: { userId } });
      await tx.reminder.deleteMany({ where: { userId } });
      await tx.goal.deleteMany({ where: { userId } });
      await tx.journalEntry.deleteMany({ where: { userId } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[user data DELETE]", error);
    return NextResponse.json({ error: "Failed to delete server data" }, { status: 500 });
  }
}
