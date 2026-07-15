import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { forUser } from "./prisma";

const FREE_WEEKLY_LIMIT = Number(process.env.FREE_WEEKLY_ANALYSIS_LIMIT ?? 3);

export interface Entitlements {
  plan: "free" | "premium";
  weeklyLimit: number | null; // null = unlimited
  used: number;
  remaining: number | null;   // null = unlimited
  canAnalyze: boolean;
  subscriptionStatus: string | null;   // "active" | "trialing" | "past_due" | "canceled" | null (lifetime/never-subscribed)
  currentPeriodEnd: string | null;     // ISO string — renewal/trial-end date, or null for lifetime
}

function isPremium(user: { plan: string; subscriptionStatus: string | null; currentPeriodEnd: Date | null }) {
  if (user.plan !== "premium") return false;
  // Lifetime purchases set plan=premium with no subscription status.
  if (!user.subscriptionStatus) return true;
  const active = user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";
  const notExpired = !user.currentPeriodEnd || user.currentPeriodEnd.getTime() > Date.now();
  return active && notExpired;
}

/** Rolling 7-day analyze count. Avoids reset-timing bugs from fixed week boundaries. */
async function weeklyAnalyzeCount(userId: string): Promise<number> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const db = forUser(userId);
  return db.usageEvent.count({
    where: { userId, kind: "analyze", createdAt: { gte: since } },
  });
}

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const db = forUser(userId);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, subscriptionStatus: true, currentPeriodEnd: true },
  });
  if (!user) throw new Error("User not found");

  const subMeta = {
    subscriptionStatus: user.subscriptionStatus ?? null,
    currentPeriodEnd: user.currentPeriodEnd ? user.currentPeriodEnd.toISOString() : null,
  };

  if (isPremium(user)) {
    return { plan: "premium", weeklyLimit: null, used: 0, remaining: null, canAnalyze: true, ...subMeta };
  }
  const used = await weeklyAnalyzeCount(userId);
  const remaining = Math.max(0, FREE_WEEKLY_LIMIT - used);
  return {
    plan: "free",
    weeklyLimit: FREE_WEEKLY_LIMIT,
    used,
    remaining,
    canAnalyze: remaining > 0,
    ...subMeta,
  };
}

export async function recordUsage(userId: string, kind: "analyze" | "transcribe") {
  const db = forUser(userId);
  await db.usageEvent.create({ data: { userId, kind } });
}

// ─── Anonymous try-mode: one earned full run, then must sign in ────────────────

const TRY_COOKIE = "progress_try_used";

export function hasUsedAnonymousTry(): boolean {
  return cookies().get(TRY_COOKIE)?.value === "1";
}

export function markAnonymousTryUsed(res: NextResponse) {
  res.cookies.set(TRY_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}
