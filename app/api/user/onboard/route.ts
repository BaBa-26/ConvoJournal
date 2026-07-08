import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const OnboardSchema = z.object({
  displayName:  z.string().trim().min(1).max(50),
  // Optional daily reflection nudge time (HH:mm, 24h). Skippable during onboarding.
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm").nullish(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body   = await req.json();
    const parsed = OnboardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { displayName, reminderTime } = parsed.data;

    await prisma.user.update({
      where: { id: auth.userId },
      data:  { displayName, reminderTime: reminderTime ?? null, onboarded: true },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
