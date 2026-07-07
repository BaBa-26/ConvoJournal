import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendPushToUser } from "@/lib/webpush";

// Fire a one-off test notification to all of the current user's devices — used by the
// "Send test" button so people can confirm push works right after enabling it.
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const sent = await sendPushToUser(auth.userId, {
    title: "Progress",
    body: "🔔 Notifications are on. This is a test.",
    url: "/",
    tag: "test",
  });

  return NextResponse.json({ ok: true, sent });
}
