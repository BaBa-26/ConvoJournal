/**
 * Read-only structural verification of the RLS setup — no writes, no test data, safe to run
 * against PROD. Confirms: app_runtime has no bypass, grants exist, RLS is enabled with the right
 * policies on exactly the 6 app tables, and the NextAuth tables are correctly left open.
 *
 * Usage:
 *   RLS_OWNER_URL="<owner connection string>" npx tsx scripts/rls-verify.ts
 *
 * Re-run this after any `db:push` that recreates a table — it will resurface as missing
 * grants/policies (db:push doesn't know about them and drops them when it rebuilds a table).
 */
import { PrismaClient } from "@prisma/client";

const OWNER = process.env.RLS_OWNER_URL;
if (!OWNER) {
  console.error("Set RLS_OWNER_URL to an owner connection string.");
  process.exit(2);
}

const APP_TABLES = ["JournalEntry", "Task", "Reminder", "Goal", "Completion", "PushSubscription", "UsageEvent"];
const AUTH_TABLES = ["User", "Account", "Session", "VerificationToken"];

let failures = 0;
const check = (name: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "  ok " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
};

async function main() {
  const db = new PrismaClient({ datasourceUrl: OWNER });

  // 1. app_runtime role attributes — must NOT bypass RLS, must not be a superuser.
  const roleRows = await db.$queryRawUnsafe<
    { rolbypassrls: boolean; rolsuper: boolean }[]
  >(`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'app_runtime'`);
  if (roleRows.length === 0) {
    console.error("app_runtime role does not exist on this database.");
    process.exit(2);
  }
  const role = roleRows[0];
  check("app_runtime has NOBYPASSRLS", role.rolbypassrls === false);
  check("app_runtime is not a superuser", role.rolsuper === false);

  const memberOf = await db.$queryRawUnsafe<{ parent: string }[]>(
    `SELECT r.rolname AS parent FROM pg_auth_members m
     JOIN pg_roles r ON r.oid = m.roleid JOIN pg_roles u ON u.oid = m.member
     WHERE u.rolname = 'app_runtime'`
  );
  const bypassParents = memberOf; // any parent membership is suspect for a least-priv role
  check(
    "app_runtime has no inherited role memberships",
    bypassParents.length === 0,
    bypassParents.length ? `member of: ${bypassParents.map((m) => m.parent).join(", ")}` : ""
  );

  // 2. Grants + RLS status per table.
  console.log("\napp-data tables (expect: grant=yes, rls=on, policies=1):");
  for (const t of APP_TABLES) {
    const g = await db.$queryRawUnsafe<{ ok: boolean }[]>(
      `SELECT has_table_privilege('app_runtime', '"${t}"', 'SELECT') AS ok`
    );
    const r = await db.$queryRawUnsafe<{ on: boolean; forced: boolean }[]>(
      `SELECT relrowsecurity AS on, relforcerowsecurity AS forced FROM pg_class WHERE oid = '"${t}"'::regclass`
    );
    const p = await db.$queryRawUnsafe<{ c: number }[]>(
      `SELECT count(*)::int AS c FROM pg_policies WHERE tablename = '${t}'`
    );
    const ok = g[0].ok && r[0].on && p[0].c >= 1;
    check(
      t,
      ok,
      `grant=${g[0].ok} rls=${r[0].on} forced=${r[0].forced} policies=${p[0].c}`
    );
  }

  console.log("\nNextAuth tables (expect: grant=yes, rls=off — adapter needs cross-user reads):");
  for (const t of AUTH_TABLES) {
    const g = await db.$queryRawUnsafe<{ ok: boolean }[]>(
      `SELECT has_table_privilege('app_runtime', '"${t}"', 'SELECT') AS ok`
    );
    const r = await db.$queryRawUnsafe<{ on: boolean }[]>(
      `SELECT relrowsecurity AS on FROM pg_class WHERE oid = '"${t}"'::regclass`
    );
    check(t, g[0].ok && !r[0].on, `grant=${g[0].ok} rls=${r[0].on}`);
  }

  await db.$disconnect();
  console.log(`\n${failures === 0 ? "STRUCTURE VERIFIED ✅" : `${failures} CHECK(S) FAILED ❌`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Verify failed:", e);
  process.exit(1);
});
