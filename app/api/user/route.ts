import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// DELETE /api/user — permanently erase the caller's account and all their data.
// Every User relation (Account, Session, JournalEntry, Task, Reminder, Goal,
// PushSubscription) is onDelete: Cascade, so deleting the User row removes everything;
// we do NOT hand-delete children. The Session row cascades too, invalidating the session.
export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    await prisma.user.delete({ where: { id: auth.userId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[user DELETE]", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
