import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

// POST /api/user/app-lock/reset — request an app-lock (PIN) reset for the signed-in account.
//
// STUB: email delivery is not wired up yet. This route validates the session and logs the intent
// so the client-side lockout gate is fully functional; dropping in a mailer later (send a signed
// reset link/code to the account email) requires no changes on the client.
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // TODO: generate a short-lived reset token and email a link/code to the user's account email.
  if (process.env.NODE_ENV !== "production") {
    console.info(`[app-lock reset] requested for user ${auth.userId} — email delivery not yet configured`);
  }

  return NextResponse.json({ ok: true, emailed: false });
}
