/**
 * One-time backfill for BUILD_SPEC 0c.
 *
 * `completedAt` now drives the 24h active-view hide (and is Phase 5's raw material). Rows that were
 * completed BEFORE the column existed have `completed = true` but `completedAt = NULL`, so they'd
 * never satisfy the hide window and would linger in active views forever. Seed those with
 * `updatedAt` — it's the best available proxy for when they were finished. It's approximate, but it
 * only touches your own legacy test data, and nothing is deleted.
 *
 * Runs as the OWNER role (prismaAdmin, ADMIN_DATABASE_URL) so it spans all users and bypasses RLS.
 * There is only one DATABASE_URL, so this hits PROD — run it deliberately, once, at deploy time:
 *
 *   npx tsx scripts/backfill-completedat.ts
 *
 * Idempotent: re-running is a no-op once every completed row has a completedAt.
 */
import { prismaAdmin } from "@/lib/prisma";

async function main() {
  const tasks = await prismaAdmin.$executeRaw`
    UPDATE "Task" SET "completedAt" = "updatedAt"
    WHERE "completed" = true AND "completedAt" IS NULL
  `;
  const goals = await prismaAdmin.$executeRaw`
    UPDATE "Goal" SET "completedAt" = "updatedAt"
    WHERE "completed" = true AND "completedAt" IS NULL
  `;
  console.log(`Backfilled completedAt — tasks: ${tasks}, goals: ${goals}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prismaAdmin.$disconnect());
