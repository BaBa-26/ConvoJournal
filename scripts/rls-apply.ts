/**
 * Applies prisma/rls.sql against a database as the owner role. Reusable for the branch, prod,
 * or after any db:push that recreates a table (db:push drops the grants/policies).
 *
 * Usage:
 *   RLS_OWNER_URL="<owner connection string>" npx tsx scripts/rls-apply.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const OWNER = process.env.RLS_OWNER_URL;
if (!OWNER) {
  console.error("Set RLS_OWNER_URL to an owner connection string.");
  process.exit(2);
}

async function main() {
  const db = new PrismaClient({ datasourceUrl: OWNER });
  const sql = readFileSync(join(process.cwd(), "prisma", "rls.sql"), "utf8");
  const statements = sql
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s && !s.split("\n").every((l) => !l.trim() || l.trim().startsWith("--")));
  for (const stmt of statements) await db.$executeRawUnsafe(stmt);
  console.log(`Applied prisma/rls.sql (${statements.length} statements).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("Apply failed:", e);
  process.exit(1);
});
