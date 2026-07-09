import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, forUser } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { validate } from "@/lib/validators";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  timezone: z.string().optional(),
});

// Save (or refresh) the push subscription for the current device, keyed by its unique endpoint.
// Also records the user's timezone so the daily goal nudge can fire at their local reminder time.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = validate(SubscribeSchema, body);
  if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

  const { endpoint, p256dh, auth: authKey, timezone } = parsed.data;
  const db = forUser(auth.userId);

  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: auth.userId, p256dh, auth: authKey },
    create: { endpoint, p256dh, auth: authKey, userId: auth.userId },
  });

  if (timezone) {
    await prisma.user
      .update({ where: { id: auth.userId }, data: { timezone } })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
