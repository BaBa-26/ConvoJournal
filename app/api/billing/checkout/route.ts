import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { forUser } from "@/lib/prisma";

// STRIPE_PRICE_YEARLY backs the "annual" plan id — named to match what's already
// configured in the Stripe dashboard rather than the more generic "ANNUAL".
const PRICE_IDS: Record<string, string | undefined> = {
  monthly:  process.env.STRIPE_PRICE_MONTHLY,
  annual:   process.env.STRIPE_PRICE_YEARLY,
  lifetime: process.env.STRIPE_PRICE_LIFETIME || undefined,
};

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { plan } = await req.json(); // "monthly" | "annual" | "lifetime"
  const price = PRICE_IDS[plan];
  if (!price) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

  const db = forUser(auth.userId);
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { email: true, stripeCustomerId: true },
  });

  let customerId = user?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email ?? undefined,
      metadata: { userId: auth.userId },
    });
    customerId = customer.id;
    await db.user.update({ where: { id: auth.userId }, data: { stripeCustomerId: customerId } });
  }

  const isLifetime = plan === "lifetime";
  // 7-day free trial on the annual plan only — the trial hero that drives conversion.
  // Monthly and lifetime charge immediately. Keep this in sync with TRIAL_DAYS in Paywall.tsx.
  const trialDays = plan === "annual" ? 7 : undefined;
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: isLifetime ? "payment" : "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?billing=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?billing=cancelled`,
    metadata: { userId: auth.userId, plan },
    ...(isLifetime
      ? {}
      : {
          subscription_data: {
            metadata: { userId: auth.userId },
            ...(trialDays ? { trial_period_days: trialDays } : {}),
          },
        }),
  });

  return NextResponse.json({ url: session.url });
}
