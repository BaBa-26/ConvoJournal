/**
 * Creates (or rotates the password of) a least-privilege Postgres role via PLAIN SQL — never
 * the Neon console, which attaches BYPASSRLS + neon_superuser membership that not even the
 * owner role can later strip (see the GOTCHA in prisma/rls.sql).
 *
 * The resulting pooled connection string is written ONLY to OUT_FILE — never to stdout, never
 * appended to .env — so it doesn't end up in a chat transcript or mixed with other secrets.
 * Open OUT_FILE yourself, copy the string into Vercel, then delete the file.
 *
 * Usage:
 *   RLS_OWNER_URL="<owner connection string>" ROLE_NAME="app_runtime" OUT_FILE="<path>" \
 *     npx tsx scripts/rls-create-role.ts
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

if (!process.env.RLS_OWNER_URL || !process.env.ROLE_NAME || !process.env.OUT_FILE) {
  console.error("Set RLS_OWNER_URL, ROLE_NAME, and OUT_FILE.");
  process.exit(2);
}
const OWNER: string = process.env.RLS_OWNER_URL;
const ROLE: string = process.env.ROLE_NAME;
const OUT_FILE: string = process.env.OUT_FILE;

// Role name is developer-controlled (env var we set ourselves), not user input — but keep it
// to a safe identifier shape before inlining into SQL.
if (!/^[a-z_][a-z0-9_]*$/.test(ROLE)) {
  console.error("ROLE_NAME must be a simple lowercase identifier.");
  process.exit(2);
}

const ownerDirect = OWNER.replace("-pooler.", ".");
const ownerPooled = OWNER.includes("-pooler.") ? OWNER : OWNER.replace(".", "-pooler.");
const password = randomBytes(24).toString("base64url");

function withCreds(url: string, user: string, pass: string): string {
  const u = new URL(url);
  u.username = user;
  u.password = pass;
  return u.toString();
}

async function main() {
  const db = new PrismaClient({ datasourceUrl: ownerDirect });

  const exists = await db.$queryRawUnsafe<{ c: number }[]>(
    `SELECT count(*)::int AS c FROM pg_roles WHERE rolname = '${ROLE}'`
  );
  if (Number(exists[0].c) > 0) {
    await db.$executeRawUnsafe(`ALTER ROLE ${ROLE} WITH LOGIN PASSWORD '${password}'`);
    console.log(`Role ${ROLE} already existed — rotated its password.`);
  } else {
    await db.$executeRawUnsafe(`CREATE ROLE ${ROLE} WITH LOGIN PASSWORD '${password}'`);
    console.log(`Created role ${ROLE} via plain SQL (no console, no BYPASSRLS, no group membership).`);
  }

  const pooled = withCreds(ownerPooled, ROLE, password);
  writeFileSync(
    OUT_FILE,
    `# ${ROLE} pooled connection string — paste into Vercel, then DELETE this file.\n${pooled}\n`
  );
  console.log(`Connection string written to ${OUT_FILE} (not printed here).`);

  await db.$disconnect();
}
main().catch((e) => {
  console.error("Failed:", e.message);
  process.exit(1);
});
