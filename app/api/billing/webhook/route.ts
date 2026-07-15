import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prismaAdmin } from "@/lib/prisma";
import type Stripe from "stripe";

export const runtime = "nodejs"; // raw body needed; not edge

// Unauthenticated, cross-user lookup by Stripe customer id — the same shape as the
// cron/webpush jobs, so this uses prismaAdmin (bypasses RLS) rather than forUser(),
// which requires a userId we don't have until after this lookup.
async function setPlanByCustomer(customerId: string, data: {
  plan: "free" | "premium";
  subscriptionStatus?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
}) {
  const user = await prismaAdmin.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) return;
  await prismaAdmin.user.update({ where: { id: user.id }, data });
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = headers().get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no_sig" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode === "payment") {
        // lifetime one-time purchase
        await setPlanByCustomer(s.customer as string, {
          plan: "premium",
          subscriptionStatus: null,
          currentPeriodEnd: null,
        });
      }
      // subscription mode is handled by the subscription.* events below
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const active = ["active", "trialing"].includes(sub.status);
      // current_period_end moved from the subscription to its line item(s) in newer
      // API versions; our checkout always creates a single-price subscription.
      const periodEnd = sub.items.data[0]?.current_period_end;
      await setPlanByCustomer(sub.customer as string, {
        plan: active ? "premium" : "free",
        subscriptionStatus: sub.status,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await setPlanByCustomer(sub.customer as string, {
        plan: "free",
        subscriptionStatus: "canceled",
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
