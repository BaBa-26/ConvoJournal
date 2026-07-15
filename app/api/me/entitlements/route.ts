import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";

export async function GET() {
  const lifetimeAvailable = Boolean(process.env.STRIPE_PRICE_LIFETIME);
  const auth = await getAuth();
  if (!auth) {
    // Anonymous try-mode: one earned run, then sign-in.
    return NextResponse.json({ plan: "anonymous", canAnalyze: true, remaining: 1, lifetimeAvailable });
  }
  const ent = await getEntitlements(auth.userId);
  return NextResponse.json({ ...ent, lifetimeAvailable });
}
