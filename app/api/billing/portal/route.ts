import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { forUser } from "@/lib/prisma";

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const db = forUser(auth.userId);
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) return NextResponse.json({ error: "no_customer" }, { status: 400 });

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
  });
  return NextResponse.json({ url: session.url });
}
