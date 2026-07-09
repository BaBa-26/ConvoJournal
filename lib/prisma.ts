import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaAdmin: PrismaClient | undefined;
};

// ─── Base client (least-privilege `app_user` role, DATABASE_URL) ───────────────
// Row-Level Security is ENABLED on every user-data table, and `app_user` has no
// BYPASSRLS, so this client can only ever see/modify rows once `app.user_id` is set
// (see `forUser`). Use it DIRECTLY only for the NextAuth tables (User/Account/Session/
// VerificationToken), which have no RLS because the adapter must read across users at
// sign-in. All USER-DATA access goes through `forUser()`.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ─── Per-request, RLS-scoped client ────────────────────────────────────────────
// Every query runs inside a transaction that first sets `app.user_id`. The `true`
// (is_local) flag scopes the setting to that transaction only, which is the ONLY
// pooling-safe form — a plain `SET` would bleed across Neon's pooled connections.
// The row-level policies match `app.user_id` against each table's `"userId"`, so a
// forgotten `where: { userId }` can no longer leak another user's rows: Postgres
// filters them out, and WITH CHECK blocks writing rows owned by anyone else.
export function forUser(userId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

// ─── Admin client (table-owner role, ADMIN_DATABASE_URL) ───────────────────────
// The owner BYPASSES RLS. Reserved for trusted system code that legitimately spans
// ALL users: the cron (due-reminder scan, daily goal nudge, completed-item cleanup)
// and server-initiated push (`sendPushToUser`). NEVER import this into a user-facing
// request handler — that would defeat the row-level isolation. Falls back to
// DIRECT_URL locally so the admin path still works before ADMIN_DATABASE_URL is set.
export const prismaAdmin =
  globalForPrisma.prismaAdmin ??
  new PrismaClient({
    datasources: {
      db: { url: process.env.ADMIN_DATABASE_URL ?? process.env.DIRECT_URL },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaAdmin = prismaAdmin;
