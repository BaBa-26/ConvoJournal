/**
 * RLS verification harness — proves the row-level isolation works BEFORE it touches prod.
 *
 * Run against a Neon BRANCH (never prod). It needs two connection strings:
 *   RLS_APP_URL   — pooled string using the least-privilege `app_user` role
 *   RLS_OWNER_URL — direct string using the owner role (bypasses RLS; used to seed + apply SQL)
 *
 * Prereq: the branch must already have prisma/rls.sql applied (paste it into the Neon SQL
 * Editor as the owner, or this script applies it for you when APPLY_RLS=1).
 *
 * Usage (PowerShell):
 *   $env:RLS_APP_URL="postgres://app_user:...pooler...";
 *   $env:RLS_OWNER_URL="postgres://owner:...direct...";
 *   $env:APPLY_RLS="1";           # optional: apply rls.sql first
 *   npx tsx scripts/rls-check.ts
 *
 * Exit code 0 = every isolation guarantee held; 1 = a check FAILED (do not deploy).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_URL = process.env.RLS_APP_URL;
const OWNER_URL = process.env.RLS_OWNER_URL;

if (!APP_URL || !OWNER_URL) {
  console.error("Set RLS_APP_URL (app_user) and RLS_OWNER_URL (owner). See file header.");
  process.exit(2);
}

const app = new PrismaClient({ datasourceUrl: APP_URL });
const owner = new PrismaClient({ datasourceUrl: OWNER_URL });

let failures = 0;
function check(name: string, pass: boolean, detail = "") {
  console.log(`${pass ? "  ok " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
}

// Run a query on the app client with app.user_id set for that transaction (mirrors forUser()).
async function asUser<T>(userId: string, op: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return app.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return op(tx as unknown as PrismaClient);
  });
}

async function main() {
  if (process.env.APPLY_RLS === "1") {
    const sql = readFileSync(join(process.cwd(), "prisma", "rls.sql"), "utf8");
    // Split on semicolons at end of line; skip comment-only chunks.
    const statements = sql
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s && !s.split("\n").every((l) => l.trim().startsWith("--") || !l.trim()));
    for (const stmt of statements) await owner.$executeRawUnsafe(stmt);
    console.log(`Applied rls.sql (${statements.length} statements) as owner.\n`);
  }

  // ── Seed: guarantee two distinct users, each owning a Task ────────────────────
  let users = await owner.user.findMany({ take: 2, select: { id: true } });
  if (users.length < 2) {
    const made = await owner.user.create({ data: { email: `rls-test-${users.length}@example.invalid`, name: "rls-test" } });
    users = [...users, { id: made.id }];
  }
  const [A, B] = users.map((u) => u.id);
  const tagA = `rls-A-${A.slice(-6)}`;
  const tagB = `rls-B-${B.slice(-6)}`;
  await owner.task.create({ data: { title: tagA, userId: A } });
  await owner.task.create({ data: { title: tagB, userId: B } });
  console.log(`Seeded tasks for two users:\n  A=${A}\n  B=${B}\n`);

  // 1. Owner bypasses RLS — sees both users' tasks.
  const ownerSees = await owner.task.findMany({ where: { title: { in: [tagA, tagB] } } });
  check("owner bypasses RLS (sees both tagged tasks)", ownerSees.length === 2, `saw ${ownerSees.length}`);

  // 2. app_user with NO app.user_id set → fail-closed, sees nothing.
  const unscoped = await app.task.findMany({ where: { title: { in: [tagA, tagB] } } });
  check("app_user without app.user_id sees zero rows (fail-closed)", unscoped.length === 0, `saw ${unscoped.length}`);

  // 3. app_user scoped to A → sees A's task, NOT B's.
  const aScoped = await asUser(A, (tx) => tx.task.findMany({ where: { title: { in: [tagA, tagB] } } }));
  check("app_user as A sees only A's task", aScoped.length === 1 && aScoped[0].title === tagA, `saw [${aScoped.map((t) => t.title).join(", ")}]`);

  // 4. app_user scoped to A cannot read B even when explicitly querying B's id.
  const crossRead = await asUser(A, (tx) => tx.task.findMany({ where: { userId: B } }));
  check("app_user as A cannot read B's rows by userId", crossRead.length === 0, `saw ${crossRead.length}`);

  // 5. app_user scoped to A cannot WRITE a row owned by B (WITH CHECK rejects it).
  let writeBlocked = false;
  try {
    await asUser(A, (tx) => tx.task.create({ data: { title: "should-be-blocked", userId: B } }));
  } catch {
    writeBlocked = true;
  }
  check("app_user as A cannot insert a row owned by B (WITH CHECK)", writeBlocked);

  // ── Cleanup our seed tasks (owner) ───────────────────────────────────────────
  await owner.task.deleteMany({ where: { title: { in: [tagA, tagB, "should-be-blocked"] } } });

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED ✅" : `${failures} CHECK(S) FAILED ❌ — do not deploy`}`);
}

main()
  .catch((e) => {
    console.error("Harness error:", e);
    failures++;
  })
  .finally(async () => {
    await app.$disconnect();
    await owner.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
