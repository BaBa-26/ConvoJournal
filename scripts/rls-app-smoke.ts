/**
 * Smoke-test the REAL forUser() client from lib/prisma.ts against the branch, connecting as
 * app_user — proves the extension's per-op set_config transaction works over Neon's pooler and
 * that RLS enforces isolation through the actual app code path (not a hand-rolled mimic).
 *
 * Reads RLS_APP_URL (app_user) + RLS_OWNER_URL (owner) from .env. Points every datasource at the
 * BRANCH before importing lib/prisma so nothing can touch prod.
 */
import "dotenv/config";

const APP = process.env.RLS_APP_URL;
const OWNER = process.env.RLS_OWNER_URL;
if (!APP || !OWNER) {
  console.error("RLS_APP_URL and RLS_OWNER_URL must be in .env (run scripts/rls-provision.ts).");
  process.exit(2);
}
const ownerDirect = OWNER.replace("-pooler.", ".");

// Pin ALL datasources to the branch BEFORE importing lib/prisma (which reads these at construct).
process.env.DATABASE_URL = APP; // base + forUser() → app_user
process.env.DIRECT_URL = ownerDirect;
process.env.ADMIN_DATABASE_URL = ownerDirect; // prismaAdmin → branch owner (unused here, but safe)

let failures = 0;
const check = (name: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "  ok " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
};

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { forUser } = await import("../lib/prisma");

  const owner = new PrismaClient({ datasourceUrl: ownerDirect });
  const users = await owner.user.findMany({ take: 2, select: { id: true } });
  if (users.length < 2) {
    console.error("Need at least 2 users on the branch; found", users.length);
    process.exit(2);
  }
  const [A, B] = users.map((u) => u.id);

  const dbA = forUser(A);
  const dbB = forUser(B);

  // 1. Create a task as A through the real extension (exercises set_config + WITH CHECK).
  const created = await dbA.task.create({ data: { title: "smoke-forUser-A", userId: A } });
  check("forUser(A).create writes A's row", created.userId === A);

  // 2. Read it back as A.
  const readA = await dbA.task.findMany({ where: { title: "smoke-forUser-A" } });
  check("forUser(A) reads its own row", readA.length === 1);

  // 3. B cannot see A's row through the real extension.
  const readB = await dbB.task.findMany({ where: { title: "smoke-forUser-A" } });
  check("forUser(B) cannot see A's row", readB.length === 0);

  // 4. A cannot create a row owned by B (WITH CHECK via the extension).
  let blocked = false;
  try {
    await dbA.task.create({ data: { title: "smoke-forUser-x", userId: B } });
  } catch {
    blocked = true;
  }
  check("forUser(A) cannot write a B-owned row", blocked);

  // 5. Update + delete round-trip as A (multi-op, each its own set_config tx).
  await dbA.task.update({ where: { id: created.id }, data: { completed: true, completedAt: new Date() } });
  const done = await dbA.task.findUnique({ where: { id: created.id } });
  check("forUser(A) update round-trips", done?.completed === true);
  await dbA.task.delete({ where: { id: created.id } });
  const gone = await dbA.task.findMany({ where: { title: "smoke-forUser-A" } });
  check("forUser(A) delete round-trips", gone.length === 0);

  // Cleanup any stray blocked-insert attempts (there shouldn't be any).
  await owner.task.deleteMany({ where: { title: { in: ["smoke-forUser-A", "smoke-forUser-x"] } } });
  await owner.$disconnect();

  console.log(`\n${failures === 0 ? "APP-PATH SMOKE PASSED ✅" : `${failures} FAILED ❌`}`);
}

main()
  .catch((e) => {
    console.error("Smoke error:", e);
    failures++;
  })
  .finally(() => process.exit(failures === 0 ? 0 : 1));
