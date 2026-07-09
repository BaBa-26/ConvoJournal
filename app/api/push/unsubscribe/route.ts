import { NextRequest, NextResponse } from "next/server";
import { forUser } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Forget this device's push subscription (called when the user turns notifications off).
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const endpoint = (body as { endpoint?: unknown }).endpoint;
  if (typeof endpoint === "string" && endpoint) {
    const db = forUser(auth.userId);
    await db.pushSubscription.deleteMany({ where: { endpoint, userId: auth.userId } });
  }
  return NextResponse.json({ ok: true });
}
