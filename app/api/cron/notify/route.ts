import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webpush";

// Must run on Node (web-push uses Node crypto) and never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only Vercel Cron (which sends `Authorization: Bearer <CRON_SECRET>`) or an external pinger
// with the same secret (as a header or ?key=) may trigger this — otherwise anyone could spam
// notifications.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

// Hour/minute/date for a Date in a given IANA timezone, using only the built-in Intl API.
function localParts(date: Date, tz: string): { minutes: number; ymd: string } | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
    const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
    const hour = Number(p.hour) % 24;
    return { minutes: hour * 60 + Number(p.minute), ymd: `${p.year}-${p.month}-${p.day}` };
  } catch {
    return null;
  }
}

async function run() {
  const now = new Date();
  let reminderPushes = 0;
  let goalPushes = 0;

  // ── 1. Due reminders ──────────────────────────────────────────────────────
  // Reminders whose time has passed but haven't been sent. Bounded to the last 25h so the very
  // first run doesn't blast every old reminder that predates this feature.
  const windowStart = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const dueReminders = await prisma.reminder.findMany({
    where: { reminded: false, eventDate: { lte: now, gte: windowStart } },
    select: { id: true, title: true, userId: true },
  });
  for (const r of dueReminders) {
    reminderPushes += await sendPushToUser(r.userId, {
      title: "Reminder",
      body: r.title,
      url: "/schedule",
      tag: `reminder-${r.id}`,
    });
    await prisma.reminder.update({ where: { id: r.id }, data: { reminded: true } });
  }

  // ── 2. Daily goal nudge ───────────────────────────────────────────────────
  // Once per local day, at (or just after) the user's reminderTime, nudge anyone with an
  // unfinished goal. The 90-min catch-up window tolerates infrequent cron schedules.
  const users = await prisma.user.findMany({
    where: { reminderTime: { not: null }, timezone: { not: null } },
    select: { id: true, reminderTime: true, timezone: true, lastGoalNudge: true },
  });
  for (const u of users) {
    if (!u.reminderTime || !u.timezone) continue;
    const local = localParts(now, u.timezone);
    if (!local) continue;

    const [h, m] = u.reminderTime.split(":").map(Number);
    const target = h * 60 + m;
    if (local.minutes < target || local.minutes > target + 90) continue;

    // Already nudged today (in the user's local day)?
    if (u.lastGoalNudge) {
      const last = localParts(u.lastGoalNudge, u.timezone);
      if (last && last.ymd === local.ymd) continue;
    }

    const openGoals = await prisma.goal.count({ where: { userId: u.id, completed: false } });
    if (openGoals === 0) continue;

    goalPushes += await sendPushToUser(u.id, {
      title: "Keep your streak",
      body:
        openGoals === 1
          ? "You have a goal to move forward today."
          : `You have ${openGoals} goals to move forward today.`,
      url: "/tasks",
      tag: "goal-nudge",
    });
    await prisma.user.update({ where: { id: u.id }, data: { lastGoalNudge: now } });
  }

  // ── 3. Cleanup: clear completed tasks/goals ~24h after completion ──────────
  // The heavy row is deleted (saves space, keeps metrics to recent activity), but the
  // durable Completion record it wrote stays, so the weekly momentum bar still credits it.
  // Old Completions are pruned past 60 days (only recent windows feed the bar).
  const cleanupCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const completionCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const [tasksCleared, goalsCleared, completionsPruned] = await Promise.all([
    prisma.task.deleteMany({ where: { completed: true, completedAt: { lt: cleanupCutoff } } }),
    prisma.goal.deleteMany({ where: { completed: true, completedAt: { lt: cleanupCutoff } } }),
    prisma.completion.deleteMany({ where: { completedAt: { lt: completionCutoff } } }),
  ]);

  return {
    reminderPushes,
    goalPushes,
    checkedReminders: dueReminders.length,
    checkedUsers: users.length,
    tasksCleared: tasksCleared.count,
    goalsCleared: goalsCleared.count,
    completionsPruned: completionsPruned.count,
  };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await run();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/notify]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// Allow POST too, so external cron services that only POST also work.
export const POST = GET;
