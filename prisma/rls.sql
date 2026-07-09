-- Row-Level Security for Progress / ConvoJournal
-- ---------------------------------------------------------------------------
-- Defense-in-depth tenant isolation at the DATABASE layer. Even if an app query
-- forgets `where: { userId }`, Postgres will not return (or let you write) rows
-- that belong to another user.
--
-- HOW IT WORKS
--   * The app runtime connects as the least-privilege role `app_runtime` (no
--     owner, no BYPASSRLS), so these policies apply to it.
--   * `lib/prisma.ts` -> forUser(userId) runs every query inside a transaction that
--     first executes  SELECT set_config('app.user_id', <userId>, true).
--   * Each policy compares that setting to the row's "userId".
--   * `current_setting('app.user_id', true)` returns NULL when unset -> matches no
--     rows (fail-closed).
--   * RLS is only ENABLED (not FORCED), so the table-owner role used by the cron /
--     migrations (ADMIN_DATABASE_URL / DIRECT_URL) still bypasses it, as intended.
--
-- APPLY (as the OWNER role, not app_runtime):
--   psql "$DIRECT_URL" -f prisma/rls.sql
--
-- RE-RUN THIS after any `npm run db:push` that recreates a table — db:push does not
-- know about these policies or grants and will drop them when it rebuilds a table.
-- The script is idempotent (safe to run repeatedly).
--
-- NOTE: RLS is applied to USER-DATA tables only. The NextAuth tables
-- (User / Account / Session / VerificationToken) are intentionally left open
-- because the adapter must read across users during sign-in.
-- ---------------------------------------------------------------------------

-- Prereq: the role `app_runtime` must exist, created via PLAIN SQL as the owner:
--   CREATE ROLE app_runtime WITH LOGIN PASSWORD 'set-a-strong-password';
--
-- ⚠ GOTCHA — DO NOT create this role through the Neon console "New Role" wizard.
-- It makes the role a member of `neon_superuser` AND sets BYPASSRLS directly on
-- the role — and critically, once created that way, NOT EVEN THE OWNER can undo
-- it: `ALTER ROLE` fails with "permission denied to alter role" (only Neon's
-- control plane has ADMIN on a console-created role), and — this one surprised
-- us — `REVOKE neon_superuser FROM <anyone>` ALSO fails for the owner even as a
-- no-op on a role that was never a member, because Postgres requires ADMIN on the
-- SOURCE role (neon_superuser) to attempt the revoke at all, which Neon reserves
-- to itself. A role created via the console silently ignores every policy below
-- (queries succeed, isolation just doesn't happen); the only fix is to DROP and
-- recreate it via plain SQL like the line above.
--
-- 0. Defensive no-op for a correctly-created role. If this errors with "permission
-- denied to alter role", the role was created via the console — DROP and recreate
-- it via plain SQL, don't debug this further.
ALTER ROLE app_runtime WITH NOBYPASSRLS;

-- 1. Privileges for the app runtime role -----------------------------------
GRANT USAGE ON SCHEMA public TO app_runtime;

-- User-data tables (RLS-protected below)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "JournalEntry", "Task", "Reminder", "Goal", "Completion", "PushSubscription"
  TO app_runtime;

-- NextAuth tables (no RLS — the adapter needs cross-user access at sign-in)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "User", "Account", "Session", "VerificationToken"
  TO app_runtime;

-- 2. Enable RLS + owner-scoped policy on each user-data table ---------------
-- WITH CHECK on the same predicate stops app_runtime from INSERTing/UPDATE-ing a
-- row onto another user's id.

ALTER TABLE "JournalEntry" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "JournalEntry";
CREATE POLICY tenant_isolation ON "JournalEntry"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Task";
CREATE POLICY tenant_isolation ON "Task"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "Reminder" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Reminder";
CREATE POLICY tenant_isolation ON "Reminder"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "Goal" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Goal";
CREATE POLICY tenant_isolation ON "Goal"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "Completion" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Completion";
CREATE POLICY tenant_isolation ON "Completion"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PushSubscription";
CREATE POLICY tenant_isolation ON "PushSubscription"
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));
