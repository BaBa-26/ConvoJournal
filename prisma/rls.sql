-- Row-Level Security for Progress / ConvoJournal
-- ---------------------------------------------------------------------------
-- Defense-in-depth tenant isolation at the DATABASE layer. Even if an app query
-- forgets `where: { userId }`, Postgres will not return (or let you write) rows
-- that belong to another user.
--
-- HOW IT WORKS
--   * The app runtime connects as the least-privilege role `app_user` (no owner,
--     no BYPASSRLS), so these policies apply to it.
--   * `lib/prisma.ts` -> forUser(userId) runs every query inside a transaction that
--     first executes  SELECT set_config('app.user_id', <userId>, true).
--   * Each policy compares that setting to the row's "userId".
--   * `current_setting('app.user_id', true)` returns NULL when unset -> matches no
--     rows (fail-closed).
--   * RLS is only ENABLED (not FORCED), so the table-owner role used by the cron /
--     migrations (ADMIN_DATABASE_URL / DIRECT_URL) still bypasses it, as intended.
--
-- APPLY (as the OWNER role, not app_user):
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

-- Prereq (run once in the Neon console, then here as owner):
--   the role `app_user` must exist. Create it in the Neon "Roles" tab, or:
--   CREATE ROLE app_user LOGIN PASSWORD 'set-in-neon';  -- Neon manages the password

-- 1. Privileges for the app runtime role -----------------------------------
GRANT USAGE ON SCHEMA public TO app_user;

-- User-data tables (RLS-protected below)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "JournalEntry", "Task", "Reminder", "Goal", "Completion", "PushSubscription"
  TO app_user;

-- NextAuth tables (no RLS — the adapter needs cross-user access at sign-in)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "User", "Account", "Session", "VerificationToken"
  TO app_user;

-- 2. Enable RLS + owner-scoped policy on each user-data table ---------------
-- WITH CHECK on the same predicate stops app_user from INSERTing/UPDATE-ing a row
-- onto another user's id.

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
