# Progress (ConvoJournal) — Handoff Doc

Last updated: 2026-07-10. **Read "🟢 Latest" directly below for current state.** Everything below it is **shipped history** — kept for context, not active work.

---

## 🟢 Latest (2026-07-10) — security audit + hardening shipped

**Live in prod (`progress-coral-eight.vercel.app`), committed `c7bc8b2` on `claude/nifty-hamilton-ISukC`, pushed to origin.** A full security audit (using the Aikido "Operating Manual" reasoning method + the vibe-security skill) found the core data model already solid — RLS is real and fail-closed, every route re-checks `requireAuth()`, the unsubscribe endpoint is the *fixed* version of the classic NoSQL-injection example, no secrets in the repo. The findings and their fixes:

**Shipped this session:**
- **HIGH-2 (closed) — durable rate limiting.** The old limiter was an in-memory `Map`, which on Vercel is **per serverless instance** — an attacker rotating IPs/instances bypassed both the per-IP and the "global" AI cap and could exhaust the Gemini/Groq quota (availability DoS; money is already bounded by the Gemini spend cap + Groq free-tier hard-stop). Added an **Upstash Redis layer** (`@upstash/ratelimit`) on `/api/transcribe` + `/api/analyze` only: 5/min per IP + 200/hr global, enforced **globally across instances**. Runs after the cheap in-memory check, so only the two AI paths pay the ~200ms Redis round-trip. **Fail-open by design** (1s timeout): if Redis is unset/unreachable it falls back to in-memory — a Redis outage can never take the app down. Reads either `UPSTASH_REDIS_REST_*` or the `KV_REST_API_*` names Vercel's Marketplace integration injects. **Verified in prod:** 6th rapid call → 429.
- **MEDIUM-1 (fixed) — the cross-account vault leak** (was bug #2 in the RLS session's deferred list). The real culprit was `VAULT_STORAGE_KEY` (`"progress:localVault"`), a single global localStorage key, so two accounts on the same browser (cloud-sync OFF) shared on-device data. Now namespaced per account via `vaultKey()` → `progress:localVault:<userId>` in `lib/localStore.ts` (+ `lib/syncMigration.ts` and `PreferencesProvider` passing `session.user.id`). A one-time migration adopts any pre-existing global vault into the first account to sign in, then deletes the shared key. (The `DEMO_STORAGE_KEY` is *not* a leak — it's ephemeral, pre-auth, reseeds daily.)
- **MEDIUM-2 (fixed) — CSP dropped `'unsafe-eval'` in production** (`next.config.js`; dev keeps it for HMR). `'unsafe-inline'` stays until a nonce-based CSP lands. **Verified in prod:** header now `script-src 'self' 'unsafe-inline'`, page still 200.
- **Cron hardening — constant-time `CRON_SECRET` compare** (`secureCompare` in `app/api/cron/notify/route.ts`) closes a timing side-channel.

**Env var added to Vercel prod:** Upstash Redis via the **Marketplace integration** (injected as `KV_REST_API_URL` / `KV_REST_API_TOKEN` + friends). Neon's "Connect" button in Storage was **deliberately left unconnected** — the DB is wired manually with the three role-split URLs from the RLS work; the integration would try to manage `DATABASE_URL` itself.

**Rate limiter naming note:** local `.env` uses `UPSTASH_REDIS_REST_*`; prod uses the integration's `KV_REST_API_*`. The middleware reads `UPSTASH_*` first, `KV_*` as fallback — both paths verified.

### ⏳ Next steps
1. **HIGH-1 (open, next session) — upgrade Next.js off 14.2.35.** `npm audit` reports 14 Next advisories (two XSS, one SSRF, RSC cache-poisoning, several DoS) + `postcss` XSS + `uuid` via `next-auth`. Fixes live only in newer majors, so this is a **breaking upgrade needing a real regression pass** (evaluate 15.x App-Router migration). Biggest remaining risk-reduction; mechanical but must be verified, not blind.
2. **Two bugs still deferred from the RLS session** (see that section below): (a) "this device only" journal saves don't populate Tasks/Goals/Calendar; (c) crisis-support card overlaps the Discard/Save buttons on mobile (safety-critical flow — do first). Bug (b) — the vault leak — is now **fixed** (above).
3. **Phase 3 — per-item notifications** (unchanged from prior plan): re-toggle the slider to re-subscribe (fixes the 403), then build Task/Reminder/Goal `notify` toggles + cron passes.
4. **Optional follow-up on rate limiting:** skip the Redis check for authenticated requests (attackers can't mint session cookies) so your own use costs zero Redis commands — keeps the durable limits pointed only at the anonymous attack surface.

**Before fully closing the CSP item:** click through the live app in a browser (record an entry, load Tasks/Goals/Schedule) to confirm dropping `'unsafe-eval'` didn't disturb any client behavior — the header + page-load checks passed, but a real click-through is the final confidence.

---

## Latest (2026-07-09, PM) — database-level Row-Level Security (RLS) shipped

**Live in prod as of this session.** Every user-data table (`JournalEntry`, `Task`, `Reminder`, `Goal`, `Completion`, `PushSubscription`) now has Postgres RLS enabled with a `tenant_isolation` policy (`"userId" = current_setting('app.user_id', true)`). This is defense-in-depth: previously isolation depended 100% on every Prisma query remembering `where: { userId }`; now Postgres enforces it at the database layer even if a query forgets.

**Architecture** (`lib/prisma.ts`):
- `forUser(userId)` — wraps every query in a transaction that first runs `SELECT set_config('app.user_id', userId, true)`. Used by **every** user-scoped API route (tasks, goals, reminders, journal, completions, push subscriptions, analyze's context lookups, user/export).
- `prismaAdmin` — connects as the table-owner role (`ADMIN_DATABASE_URL`, bypasses RLS). Reserved for `app/api/cron/notify` (spans all users: due reminders, daily goal nudge, completed-item cleanup) and `lib/webpush.ts`'s `sendPushToUser`. **Never** import this into a user-facing request handler.
- Base `prisma` client (now running as `app_runtime`, RLS-restricted) is still used directly for the NextAuth tables (`User`/`Account`/`Session`/`VerificationToken`), which have no RLS — the adapter legitimately reads across users at sign-in.
- Two routes (`user/data` DELETE, `user/import`) use multi-statement `$transaction`; those set `app.user_id` as the transaction's first raw statement instead of using `forUser()`.

**Runtime role is `app_runtime`, NOT `app_user` — this matters:**
- ⚠️ **Never create this role via the Neon console "New Role" wizard.** It silently grants `BYPASSRLS` + membership in `neon_superuser`, and critically, **not even the database owner can undo it afterward** — `ALTER ROLE` and `REVOKE neon_superuser FROM ...` both fail with "permission denied" (Neon reserves `ADMIN` on that group to its own control plane). A role created that way makes every RLS policy silently inert (queries succeed, isolation just doesn't happen) with no SQL-level fix. This ate a large chunk of this session — first discovered on prod after the role had already been console-created and env vars already pointed at it.
- **The only fix once a role is console-tainted: abandon it, create a new one via plain `CREATE ROLE ... WITH LOGIN PASSWORD '...'` as the owner.** That's why the canonical role is now `app_runtime` (created cleanly this way) — the original console-created `app_user` is orphaned/unused in prod and can be deleted via the Neon console UI (SQL can't touch it either, but the console's own delete works fine).
- `prisma/rls.sql` documents this gotcha inline and includes a step-0 defensive `ALTER ROLE app_runtime WITH NOBYPASSRLS` that will fail loudly (rather than silently no-op) if this class of mistake ever happens again.
- **Re-run `prisma/rls.sql` after any `db:push` that recreates a table** — `db:push` doesn't know about the grants/policies and drops them when it rebuilds a table.

**Verification tooling** (`scripts/rls-*.ts`, all read RLS_OWNER_URL/etc. from env, never hardcode secrets):
- `rls-provision.ts` — one-shot: create/rotate a role + apply `rls.sql` + write test URLs to `.env` (branch/test use only, refuses to be mistaken for prod).
- `rls-create-role.ts` — creates a role via plain SQL, writes the resulting connection string to a file (never stdout/chat) for manual pasting into Vercel.
- `rls-apply.ts` — applies `prisma/rls.sql` against any owner connection (reusable for prod re-applies after a `db:push`).
- `rls-check.ts` (`npm run test:rls`) — functional isolation proof: seeds two tagged rows for two real users, proves owner-bypass / fail-closed-when-unscoped / scoped-read-only-own-rows / cross-read-blocked / cross-write-rejected, cleans up after itself. **Branch-only** (creates real rows) — never run against prod.
- `rls-app-smoke.ts` — same proof but through the *real* `forUser()` extension (not hand-rolled SQL), confirming the actual app code path works over Neon's pooler.
- `rls-verify.ts` — **read-only, safe on prod.** Structural check only (role attributes, grants, RLS-enabled + policy-count per table). Used to confirm prod without touching any real user rows.

**What was actually verified before/after the prod cutover:**
1. Full functional isolation proof (`rls-check.ts` + `rls-app-smoke.ts`) on a Neon branch — all checks passed, including through the real `forUser()` code over the pooler.
2. Structural verification on prod (`rls-verify.ts`) — `app_runtime` has `NOBYPASSRLS`, correct grants, RLS enabled with exactly 1 policy on all 6 tables, NextAuth tables correctly left open.
3. Post-deploy prod smoke: clean `200`/`401` responses (no `500`s), zero error-level entries in Vercel function logs.
4. **Not done:** a seeded functional isolation test against prod's *real* data (deliberately skipped — would have briefly attached a throwaway row to a real user's account). The branch proof + prod structural match is the accepted substitute.
5. **Still needs Aarrav's final confirmation:** sign into the live site with a real account and confirm normal use works cleanly end-to-end. If anything's off, rollback is one line — revert Vercel's `DATABASE_URL` to the old owner string and redeploy.

**Env vars added/changed in Vercel prod:**
- `DATABASE_URL` — now the `app_runtime` pooled connection string (was the owner string)
- `ADMIN_DATABASE_URL` — **new**, owner pooled string (used by `prismaAdmin`)
- `DIRECT_URL` — unchanged (owner, direct — migrations)

**Cleanup still open (low urgency, cosmetic):**
- Delete the orphaned, console-created `app_user` role from the Neon console (Roles tab) — it's unused now but still exists with its `BYPASSRLS` mistake baked in.
- A scratchpad file holding the `app_runtime` password (outside the repo, session-temp dir) should be deleted once confirmed no longer needed.

**A caution for next session:** `npx vercel --prod` deploys the **local working directory**, not just committed git state — an uncommitted script (`scripts/rls-create-role.ts`) broke the Vercel build mid-session with a TS narrowing error that `tsc --noEmit` hadn't caught yet (it was written *after* the last local typecheck). Always re-run `npx tsc --noEmit` immediately before any `vercel --prod` if new files were added since the last check, not just after editing existing ones.

### 🐛 Found during this session's manual testing (deferred to next session — none are RLS-related)
All three surfaced while testing the branch build locally in "this device only" (localStorage) mode. RLS governs the *database*; local mode never touches it, so these need separate, unrelated fixes:
1. **"This device only" journal saves don't populate Tasks/Goals/Calendar.** The journal save writes to `localStorage` in local mode, but those screens read from the server (`GET /api/tasks` etc.) unconditionally — save goes one place, the list screens read another. Pre-existing bug, not introduced this session.
2. **Local (device-only) entries leak across accounts — ✅ FIXED 2026-07-10** (see the top "🟢 Latest" section). The vault key is now namespaced per account (`vaultKey()` → `progress:localVault:<userId>`). The demo key was never a leak (ephemeral, pre-auth, reseeds daily).
3. **Mobile UI: crisis-support card overlaps action buttons.** When the self-harm/crisis detector fires, the mobile layout pushes the "keep on device" toggle underneath the Discard/Save buttons, making it hard to tap. This is in the safety-critical review flow (`components/CrisisSupportCard.tsx` + the journal review layout) — should be the first of these three to fix given it's user-safety-adjacent, not just a cosmetic bug.

### Also discussed, decided against (for context, don't re-litigate)
Considered migrating to **Neon Data API + Neon Auth + Neon RLS** (the Supabase-style "client talks directly to Postgres via a JWT" model) instead of the `forUser()` approach. Decided against it: this app's backend does real work beyond CRUD (Gemini/Groq calls with secret keys, crisis detection, prompt-injection defense, goal auto-advance, cron jobs) that can't move to a thin client-direct-to-DB model, and NextAuth's default session token isn't a verifiable JWT the way Neon RLS wants — adopting it would mean re-platforming auth for no net security gain over what's already shipped. Worth reconsidering only if this app ever goes backend-light from scratch.

---

## Latest (2026-07-09, AM) — shipped & deployed

All committed on `claude/nifty-hamilton-ISukC`, pushed to origin, and deployed to prod (`progress-coral-eight.vercel.app`) via `npx vercel --prod --yes`. Typecheck clean, `npm run test:parser` 47/47, prod smoke test 200/401 as expected. Phase-1 schema was `db:push`'d to prod (additive: `Task.completedAt`, `Goal.completedAt`/`step`, new `Completion` model).

- **AI crisis modes** (`lib/crisis.ts`) — two-layer detection (deterministic keyword tiers + Gemini STEP-5), soft-landing `CrisisSupportCard` above review, **zero-retention** (risk never persisted). `filterCrisisActionables` stops crisis phrasing becoming to-dos ("I want to die" ≠ a task "Die"). Broadened the deterministic dictionary + a hard-drop backstop for run-ons. Fixtures in `scripts/parser-check.ts`.
- **Phase 1 — completed cleanup + weekly momentum + goal logging.** Completed tasks/goals auto-delete ~24h after completion (cron pass), but a tiny durable `Completion` row survives so wins still count. Goals screen's **momentum bar** = this-week live-goal progress + goals completed/cleared this week (`GET /api/completions`) → never a demoralizing 0%, "all clear" empty state. Goal cards got a per-goal `step` + an editable quick-log-N amount.
- **Phase 2 — 3-way task↔reminder↔goal conversion.** `ItemEditModal` is now a unified editor with an unlocked type toggle; `lib/itemConvert.ts` creates the target row + deletes the source (remote + demo). Wired into Tasks, Schedule, and Goals (goal edit now uses the shared modal).
- **Dev login fixed** — Credentials provider can't create DB sessions, so dev now uses **JWT sessions** (`NODE_ENV`-gated; prod stays database). No more "sign in bounces to /landing."
- **First-run onboarding guaranteed** — enforced **server-side + DB-authoritative** in `app/page.tsx` (fires from any entry point; a stale JWT can't loop it). Onboarding self-heals + hard-navigates on completion.
- **Guest journal hint** — signed-out idle screen suggests what to talk about (day / weekly-monthly goals / tasks / something to improve).

### ⏳ Next steps
1. **Phase 3 — notifications (next session).** VAPID + `CRON_SECRET` ARE set in prod, but a live cron run logs `[webpush] send failed 403` — the stored subscription was made against a public key that no longer pairs with the current private key. Fix: re-toggle the notifications slider to re-subscribe, then "Send test" (bypasses cron). Then **build per-item "notify me" toggles** (Task/Reminder/Goal `notify` fields + cron passes). iPhone needs Add-to-Home-Screen; Hobby cron is once/day → point cron-job.org at `/api/cron/notify?key=<CRON_SECRET>` for timely delivery.
2. **Guest-hint copy** — currently a softened default; swap for Aarrav's exact phrasing if desired.
3. Older backlog (still open): signed-out "one free try" funnel; Gemini Flash-Lite A/B.

---

## Latest (2026-07-07) — shipped history

All committed on `claude/nifty-hamilton-ISukC` and deployed to prod (`progress-coral-eight.vercel.app`) via `npx vercel --prod --yes` (Git auto-deploy is broken since the repo rename — see below). Typecheck clean, routes verified 200.

- **New landing page** (`app/landing/page.tsx`) — the "Progress Landing" claude.ai/design: sticky nav, animated flowing-path hero, grow-in ring+dot mark, scroll-reveal sections, payoff mock, mission, CTAs. Scoped CSS (fonts mapped to next/font vars), full-bleed breakout, mobile responsive.
- **Circle-with-dot brand mark** — `components/BrandMark.tsx` (SVG ring+dot) on landing, `SideNav` wordmark, and login; favicon (`app/icon.tsx`) + PWA icons (`api/pwa-icon`) redrawn as the mark. `SideNav`/`BottomNav`/`ProfileButton` all hide on `/login`,`/landing`,`/onboarding`.
- **Error handling** — `app/error.tsx` (route error boundary) + `app/not-found.tsx` (themed 404).
- **Web-push notifications** (built, dormant) — service worker, `lib/webpush`/`lib/push`, subscribe/unsubscribe/test routes, secret-guarded `/api/cron/notify` (due reminders + daily goal nudge), opt-in **slider** on Profile, `vercel.json` cron. `PushSubscription` + `User.timezone`/`lastGoalNudge` **already migrated in prod**. Needs VAPID + `CRON_SECRET` env to actually fire (see Next steps).
- **Editable everywhere** — extracted shared `components/ItemEditModal.tsx`; tasks & reminders now editable/deletable on Tasks, Reminders, and Schedule.
- **Journal mic-first** — recording is the landing view; a clear "View past entries" bar (nav-safe) opens history.
- **Profile / Settings split** — `/profile` (identity, sign-in, notifications) separate from `/settings` (appearance, layout, background); sidebar account block; avatars route to `/profile`.
- **Dashboard trackers** — task-progress + goals tracker widgets across all 3 layouts; Goals tab got an overall progress overview; Tasks got a progress/checklist view toggle.
- **Fixes** — streak caption now reflects the real streak (was hard-coded "five weeks"); notif `enablePush` requests permission before the VAPID check so the browser prompt shows on the first slider click.

_Previously (2026-07-04, still live):_ Smart Goals (create + auto-advance from journal), inline-editable calendar, hardened AI injection guardrails, Gemini cost cut (`thinkingBudget:0`), Vercel Speed Insights.

### ⚠️ Deploy + migration workflow
- **Deploy with `npx vercel --prod --yes`** — GitHub repo rename (`ConvoJournal`→`Progress`) broke Vercel Git auto-deploy, so pushing no longer builds. Push to `origin` too, to keep the repo current.
- **`db:push` BEFORE/with any schema-change deploy.** `migrate dev` fails **P3019** (sqlite lock vs Neon Postgres), so use `npm run db:push` (writes straight to the single prod Neon DB — needs explicit OK). Lesson learned the hard way: deploying a schema that added `User` columns *without* migrating first broke Google sign-in (NextAuth's adapter selects all User columns).

### ⏳ Next steps
1. **Activate notifications (top priority).** DB is already migrated; just add env (local `.env` + Vercel): generate VAPID via `npx web-push generate-vapid-keys` → set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (=public), `VAPID_SUBJECT`, `CRON_SECRET`; redeploy. iPhone needs Add-to-Home-Screen; Hobby cron is once/day, so for timely reminders point cron-job.org at `/api/cron/notify?key=<CRON_SECRET>`.
2. **Signed-out "one free try" funnel** (awaiting mockup) — one entry, see the extraction, then a sign-in wall (no local save); gate the 2nd. `JournalScreen.tsx` hardcodes `requiresAuth={false}`; fix flips it to `requiresAuth={!session}` + a localStorage try-flag.
3. **Cost follow-up** — A/B **Gemini 2.5 Flash-Lite** vs Flash over ~20 real entries before switching (Lite ~3–6× cheaper, must hold quality). `/api/analyze` is public — a token-burn vector at scale; consider a budget guard/gate.

---

## 🎨 Dashboard Redesign + Goals Progress — SHIPPED (historical)

Implementing the `Progress Dashboard.dc.html` claude.ai/design mockup: a redesigned Today screen with **3 selectable layouts**, **full personalization** (accent color, name, type size, reminder time, light/dark), and **Goals progress tracking** (per-task 0–100% with a draggable progress bar).

### ⛔ Migration NOT applied (do this carefully, with user approval)
`prisma/schema.prisma` was edited (new `Task.progress Int @default(0)` + User personalization columns: `accentColor`, `typeScale`, `reminderTime`, `themeLayout`, `colorMode`, `widgetOrder String[]`, `hiddenWidgets String[]`). **The migration was deliberately NOT run** — `prisma migrate dev` hits the shared Neon DB and the auto-mode classifier blocked it as a "production deploy before local verification." All columns are additive/defaulted so they're backward-compatible (existing prod app keeps working), but **authenticated mode will 500 on `/api/tasks`, `/api/user/preferences` etc. until the migration is applied.** **Demo mode (signed out) needs NO migration** — it's all localStorage — so verify there first. User rule: **do NOT deploy/migrate until verified in local dev, and not without explicit confirmation.**
- When approved: `npx prisma migrate dev --name add_personalization_and_task_progress`. Watch for a drift-reset prompt (should be clean since prod was built from existing migrations).

### What's DONE (code written, not yet typechecked or run)
- **Data/types/validators**: `types/index.ts` (Task.progress, `UserPreferences`, `ThemeLayout`/`ColorMode`/`TypeScale`/`WidgetKey`, `ACCENT_SWATCHES`, `DEFAULT_PREFERENCES`, `AgendaItem`/`WeekStats`/`TaskStats`/`StreakDay`). `lib/validators.ts` (`TaskUpdateSchema.progress`, `UserPreferencesUpdateSchema`).
- **API**: NEW `app/api/user/preferences/route.ts` (GET/PATCH, auth-gated, mirrors `user/onboard`). `app/api/tasks/[id]/route.ts` PATCH extended with progress↔completed sync (progress→100 sets completed; completing snaps progress→100).
- **Theming**: `tailwind.config.js` new CSS-var `accent` token (`rgb(var(--accent) / <alpha-value>)`). `app/globals.css` `--accent*`/`--type-scale` defaults + `[data-color-mode="light"]` block; `.btn-primary`/`.input` migrated `gold`→`accent`. NEW `lib/theme.ts` (accent hex→RGB-channel map, `preferenceCssVars`, `formatReminderLabel`). NEW `components/PreferencesProvider.tsx` (context + `usePreferences()`+`patchPrefs`, threads CSS vars via `display:contents` wrapper; API when authed, demoData when not). Wired into `app/layout.tsx`. `SideNav`/`BottomNav` active gold → `rgb(var(--accent))`.
- **Today dashboard**: `components/today/useTodayData.ts` (one fetch → agenda/weekStats/streak/heatmap/recent), `useTodayHeader.ts`, `widgets.tsx` (AgendaList, StreakHeatmap, WeeklyStats, TonightCTA, TomorrowPreview, RecentReflections — use shadcn `bg-card`/`text-foreground`/`border-border` tokens so they flip with light/dark). `DaybreakLayout.tsx` (light/dark toggle), `HearthLayout.tsx` (hero+sun glow, dark-only), `MosaicLayout.tsx` (framer-motion `Reorder` drag-reorder + hide, persisted via prefs). `TodayScreen.tsx` is now a thin switcher on `prefs.themeLayout`.
- **Settings**: `components/SettingsScreen.tsx` new "Personalize" section (name, accent swatches, type size, reminder time, layout picker, light/dark for Daybreak).
- **Demo parity**: `lib/demoData.ts` — `DemoState.preferences` slice (+ backfill for old blobs), `loadDemoPreferences`/`updateDemoPreferences`, `progress` on all demo tasks (varied 0/40/75/100 + a completed task), extra consecutive-day entries so streak/heatmap shows a real run.
- `lib/taskStats.ts` — `computeTaskStats(tasks)` shared by Today's WeeklyStats and (pending) the Goals header.

### What's DONE since (now also complete)
- **Goals progress UI** — `components/DraggableProgressBar.tsx` (framer-motion `useMotionValue`+`drag="x"`, drag→0–100, commit on drag-end + tap-to-set on track). Integrated into `TaskRow` (local optimistic `progress` + `handleProgressCommit` mirroring `handleToggle`/`handleDelete`, PATCH `{progress}`; bar hidden when complete). Header now shows a **progress overview** (X of N complete, completion %, bar, priority breakdown via `computeTaskStats`). `handleToggle` snaps local `progress:100` on complete. Tasks title renamed "Tasks"→"Goals"; checkbox/add-button migrated `gold`→`accent`. `ScheduleScreen` demo Task literal got `progress:0`.
- **Typecheck**: `npx tsc --noEmit` is **clean** (Prisma client regenerated via `prisma generate` — codegen only, no DB).
- **Local verify (demo mode)**: `npm run dev` signed-out — `/`, `/tasks`, `/schedule`, `/settings`, `/journal` all compile + return **200, no errors**. SSR HTML confirms the provider threads `--accent: 200 168 120` (RGB channels) + `--type-scale:1` via a `display:contents` wrapper with `data-color-mode="dark"`, and the Daybreak layout + Goals progress overview render. (Interactive drag/reorder/accent-switching are client-only — exercise by hand in the browser to fully confirm.)

### What's LEFT
1. **Manual browser pass (demo mode)** — open localhost:3000 signed out and click through: Settings → layout picker (Daybreak/Hearth/Mosaic), accent swatches, type size S/M/L, Daybreak light/dark; Mosaic Edit-layout drag-reorder + hide/show; Goals drag a progress bar. Confirm it feels right (only the static SSR shell was auto-verified).
2. **Neon migration** (with explicit user OK) — `npx prisma migrate dev --name add_personalization_and_task_progress`. Required before **authenticated** mode works (prefs + task.progress columns). Then verify signed-in, then deploy. Migration was intentionally blocked this session per the "verify locally first / don't deploy without confirmation" rule.

### Key decisions (don't re-litigate)
- All 3 layouts share ONE data hook + ONE widget set; only chrome differs. Light mode is **Daybreak-only and scoped to the Today surface** (rest of app stays dark — matches mockup). Accent is RGB-channel CSS var (so `/opacity` utilities work); heatmap uses `color-mix(in oklab, rgb(var(--accent)) X%, transparent)`. `gold-*` Tailwind tokens kept for fixed brand chrome (Journal/Schedule/onboarding intentionally still literal gold).

---

## What It Is

A mobile-first voice journaling PWA called **Progress**. Speak a daily brain-dump → it transcribes, parses Yesterday / Today / Tomorrow sections, extracts tasks + reminders via Gemini 2.5 Flash, and saves everything to Postgres. Unauthenticated users can try voice/transcription freely and see demo data; saving requires sign-in.

Production: `https://progress-coral-eight.vercel.app` · Vercel project `baba-26s-projects/progress` · GitHub `BaBa-26/ConvoJournal` (branch `claude/nifty-hamilton-ISukC`).

---

## ⚠️ Older session history (all resolved — kept for context)

1. **Reminders IDOR — FIXED & DEPLOYED.** `app/api/reminders/[id]/route.ts` PATCH/DELETE once had no auth/ownership check; it now uses `ownedReminder()` (mirrors `tasks/[id]`) and is live in prod. No longer an open issue.
2. **Vercel deploys were broken for a while** — root causes (both fixed, verified working):
   - `.vercel/output` was committed to git, so Vercel reused stale prebuilt output on every git-push deploy instead of building fresh. Untracked it, added `.vercel/` to `.gitignore`.
   - `styled-jsx` version mismatch (we had `^5.1.7`, Next.js 14.2.35 wants exactly `5.1.1`) caused npm to keep two copies, breaking the build's file tracer. Pinned to exact `5.1.1` so npm dedupes to one root copy.
   - If `ENOENT styled-jsx` or "Cannot find module styled-jsx" ever resurfaces, check those two things first before anything else.
3. **Gemini API key was dead, now fixed.** The `AQ.`-prefixed key in `.env`/Vercel was simply invalid on Google's side (confirmed via raw curl against multiple endpoints/transports — all failed identically, which only makes sense if the key itself is bad). **Note: `AQ.` IS the legitimate current Gemini Developer API key format from aistudio.google.com — it's not a wrong-page mistake, don't re-litigate that if it comes up.** User regenerated a key, it works. Production `GEMINI_API_KEY` was rotated and redeployed — verified live.
4. **New tool: `npm run test:gemini`** (`scripts/test-gemini.ts`) — runs `analyzeWithGemini()` locally against a sample (or custom, via CLI arg) journal entry and prints the full prompt + raw Gemini response + parsed result. Debug logging lives in `lib/gemini.ts` gated behind `GEMINI_DEBUG=true`. Use this instead of recording real audio to debug prompt/extraction issues.
5. Other open items, not urgent:
   - `npm audit`: 4 known vulns (3 moderate, 1 high) in `next`/`postcss`/`uuid` — full fix needs a `next@16` major upgrade (breaking). Needs a user decision, not done.
   - Spending caps in Google AI Studio + Groq dashboards — recommended, never confirmed done.
   - GitHub shows a "repository moved" notice on every push (`BaBa-26/ConvoJournal` → `BaBa-26/Progress`) — cosmetic, not addressed.

### Working-style notes for whoever picks this up
- **Secrets must never surface in visible output.** Pipe values from `.env` via stdin into `vercel env add` rather than typing them in command text; when inspecting a key, print only prefix+length. User has actively blocked attempts to `vercel env pull` (dumps all secrets to a file).
- **Don't deploy without explicit confirmation** unless the user clearly asks for deployment in the same message.
- User wants evidence-based debugging, not repeated guessing — isolate variables methodically (e.g. raw curl bypassing the SDK) rather than re-suggesting the same fix.
- `TAask.md` (gitignored, repo root) is the user's own troubleshooting notes — check it before re-deriving things they've already researched.

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + custom theme (ink / parchment / gold) |
| Database | Prisma 5 + **Neon Postgres** (prod) |
| Auth | NextAuth v4 — Google OAuth (env-gated) + dev credentials (dev-only) |
| Voice | **Groq Whisper** (`whisper-large-v3-turbo`) via `groq-sdk` — server-side only |
| Analysis | **Gemini 2.5 Flash** via `@google/genai` (`lib/gemini.ts`) — falls back to local regex parser (`lib/parser.ts`) on error |
| Autocomplete | Custom Trie + bigram N-gram (`lib/autocomplete.ts`) |
| Demo mode | `lib/demoData.ts` — localStorage-backed fake data (entries/tasks/reminders/goals) for unauthenticated users |
| Date utils | date-fns, chrono-node |
| Analytics | `@vercel/speed-insights` — `<SpeedInsights/>` in `app/layout.tsx` (populates once enabled in the Vercel dashboard) |

`lib/openai.ts` (dead code from the old OpenAI Whisper era) has been deleted — no longer present.

---

## File Structure

```
app/
  api/
    auth/[...nextauth]/route.ts  → NextAuth handler
    transcribe/route.ts          → Groq Whisper transcription (public, GROQ_API_KEY, 5/min rate limit)
    analyze/route.ts             → Gemini 2.5 Flash (lib/gemini.ts), regex fallback on error (public, 5/min rate limit)
    journal/route.ts             → CRUD for JournalEntry (auth required)
    tasks/route.ts               → GET + POST tasks (auth required)
    tasks/[id]/route.ts          → PATCH + DELETE tasks (auth + ownership check)
    reminders/route.ts           → GET + POST reminders (auth required)
    reminders/[id]/route.ts      → PATCH + DELETE reminders (auth + ownership check — FIXED this session, not yet deployed)
    user/onboard/route.ts        → Marks User.onboarded (auth required)
    pwa-icon/route.tsx           → Dynamically generated PWA icon
  icon.tsx                       → Dynamically generated favicon/app icon
  login/page.tsx                 → Sign-in page (Google OAuth + dev credentials)
  landing/page.tsx               → Marketing / landing page
  onboarding/page.tsx            → First-sign-in onboarding flow
  layout.tsx                     → Root layout, PWA meta, fonts, AuthProvider, SideNav
  page.tsx                       → Mounts TodayScreen + BottomNav (home dashboard)
  journal/page.tsx               → Mounts JournalScreen + BottomNav
  tasks/page.tsx                 → Mounts TasksScreen
  reminders/page.tsx             → Mounts RemindersScreen (not linked in nav)
  schedule/page.tsx              → Mounts ScheduleScreen
  settings/page.tsx              → Settings screen
  globals.css                    → Tailwind base + component classes
  manifest.json                  → PWA manifest
components/
  TodayScreen.tsx                → Home dashboard — greeting, agenda, quick links
  JournalScreen.tsx              → 5-phase entry flow + entry history list (idle phase) — 640+ lines
  TasksScreen.tsx                → Task list + auth gate
  RemindersScreen.tsx            → Reminder list + auth gate
  ScheduleScreen.tsx             → Calendar + day panel + upcoming feed
  SideNav.tsx                    → Desktop sidebar (hidden on mobile)
  BottomNav.tsx                  → Mobile bottom nav (hidden on md+)
  AuthProvider.tsx               → NextAuth SessionProvider wrapper
  Waveform.tsx                   → Animated recording waveform bars
  ui/hero-dithering-card.tsx     → CTA section with Dithering shader (landing page only)
hooks/
  useRecorder.ts                 → MediaRecorder + Groq Whisper fetch hook
lib/
  auth.ts                        → NextAuth config + requireAuth() guard
  validators.ts                  → Zod schemas for all API inputs (incl. ReminderUpdateSchema — added this session)
  gemini.ts                      → Gemini 2.5 Flash client, prompt injection defense, GEMINI_DEBUG logging
  parser.ts                      → Regex fallback section splitter + task/reminder extractor
  autocomplete.ts                → Trie + NGram suggestion engine
  demoData.ts                    → Demo state seed + localStorage persistence
  prisma.ts                      → Prisma singleton
  wordlist.ts                    → Static word seed for autocomplete
middleware.ts                    → Rate limiting (5/min AI endpoints, 200/hr global AI cap) + security headers
scripts/
  test-gemini.ts                 → Local Gemini debug harness (npm run test:gemini) — NEW this session
types/
  index.ts                       → All shared TS interfaces
  next-auth.d.ts                 → Extends Session with user.id
prisma/
  schema.prisma                  → User, JournalEntry, Task, Reminder + NextAuth models (Postgres)
```

---

## Security (implemented)

| Layer | What was done |
|-------|---------------|
| Auth | NextAuth v4, all data routes require session; userId scoped on every query |
| IDOR | `ownedTask()` / `ownedReminder()` check before PATCH/DELETE → 404 not 403 (reminders fix pending deploy, see above) |
| File uploads | 25 MB cap (Content-Length + blob.size), strict MIME allowlist → 413/415 |
| Input validation | Zod on every POST/PATCH — enums, length caps, datetime format |
| Rate limiting | Two layers (2026-07-10): in-memory sliding window (5/min transcribe, 5/min analyze, 60/min default) **+ durable Upstash Redis** on the two AI paths (5/min per IP + 200/hr global, enforced across serverless instances; fail-open). Backstop: Gemini spend cap + Groq free-tier hard-stop |
| HTTP headers | CSP, X-Frame-Options, HSTS, nosniff, Referrer-Policy, Permissions-Policy |
| Secrets | `.env`, `.vercel/`, `*.db` gitignored; never committed (verified via full git history search); no `NEXT_PUBLIC_` leakage |
| Prompt injection | `[STRICT SECURITY RULE]` fence + phrase-based `INJECTION_RE`; `sanitizeField` (narrative) + `sanitizeTitle` (task/goal titles, strips fence tokens); prompt boundary re-asserted when transcript looks like an override |
| Goals IDOR | `goalUpdates` accepted only for the user's own active-goal IDs (hallucinated IDs dropped); `/api/journal` re-checks ownership before incrementing |
| Try-mode | `/api/transcribe` + `/api/analyze` public; saving requires auth. Token-burn now bounded by durable Upstash rate limiting + provider spend caps (see Rate limiting row) |
| CSP | `'unsafe-eval'` dropped from `script-src` in production (2026-07-10); dev-only for HMR. `'unsafe-inline'` stays pending a nonce-based CSP |

Security audits: 2026-06-30 (found the reminders IDOR, since fixed) and **2026-07-10** (Aikido-method + vibe-security full audit — closed HIGH-2 rate limiting, MEDIUM-1 vault leak, MEDIUM-2 CSP, cron timing side-channel; **HIGH-1 Next.js dependency upgrade still open**). No hardcoded secrets, no raw SQL, the one `dangerouslySetInnerHTML` is a static constant (landing page CSS), errors don't leak internals to clients.

---

## Data Models

**User** — created on first sign-in via NextAuth adapter; `onboarded: Boolean` gates `/onboarding` redirect
**JournalEntry** — one per user per day (upsert on `userId + date`)
- `rawContent`, `yesterday`, `today`, `tomorrow`, `mood`
- Relations: `tasks[]`, `reminders[]`

**Task**
- `title`, `description`, `dueDate`, `priority` (high/medium/low), `completed`, `progress` (0–100)
- `source`: `"journal"` (auto-extracted) | `"manual"` (user-added)

**Reminder**
- `title`, `description`, `eventDate`, `reminded` (reserved for future push)

**Goal**
- `title`, `unit` (free-form counting noun, default `"times"`), `target` (int ≥1), `current` (0…target), `period` (`week`/`month`/`ongoing`), `completed` (mirrors `current ≥ target`), `source` (`journal`/`manual`)
- No relation to `JournalEntry` — goals persist independent of the entry that created them.

All models: `userId` FK with `onDelete: Cascade`.

---

## API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/transcribe` | POST | No | Audio blob → Groq Whisper → `{ text }` |
| `/api/analyze` | POST | No | Text → Gemini 2.5 Flash → parsed JSON (regex fallback on error) |
| `/api/journal` | GET | Yes | Fetch last N entries (max 100) |
| `/api/journal` | POST | Yes | Upsert entry by date, create tasks/reminders |
| `/api/tasks` | GET/POST | Yes | List / create tasks |
| `/api/tasks/[id]` | PATCH/DELETE | Yes | Update / remove task (ownership-checked) |
| `/api/reminders` | GET/POST | Yes | List / create reminders |
| `/api/reminders/[id]` | PATCH/DELETE | Yes | Update / remove reminder (ownership-checked) |
| `/api/goals` | GET/POST | Yes | List / create goals |
| `/api/goals/[id]` | PATCH/DELETE | Yes | Update / remove goal (ownership-checked, clamps `current ≤ target`) |
| `/api/user/onboard` | POST | Yes | Mark onboarding complete |
| `/api/user/preferences` | GET/PATCH | Yes | Dashboard personalization (accent/layout/etc.) |

---

## Screens

### Today (`/`)
Home dashboard. Greeting based on time of day, today's agenda (tasks due today/overdue + reminders sorted by time), quick links to Calendar and Goals, CTA to write tonight's reflection.

### Journal (`/journal`)
5-phase state machine: Idle (entry history) → Writing (textarea + autocomplete) → Recording (waveform) → Analyzing (Gemini call, transcript reveal) → Review (parsed sections, mood badge, tasks/reminders, Save).

Unauthenticated users see demo entries seeded from `lib/demoData.ts`.

### Goals / Tasks (`/tasks`)
`GoalsSection` (unit-aware goal cards with ± steppers + inline edit) on top, then the task list with per-task progress bars. Branded "Goals" in nav.

### Schedule (`/schedule`)
Month calendar + day panel + upcoming feed. Tasks & reminders are **inline-editable** (pencil → bottom-sheet modal); type locked in edit mode.

### Reminders (`/reminders`, not in nav), Settings (`/settings`), Onboarding (`/onboarding`)
Standard CRUD/auth-gated screens — see component files above.

---

## Setup

```bash
npm install
npm run db:push            # push Prisma schema to DATABASE_URL
npm run dev                # http://localhost:3000
npm run test:gemini        # debug Gemini prompt/response locally
```

Required env vars: `DATABASE_URL`, `DIRECT_URL`, `GROQ_API_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GEMINI_API_KEY`. Optional: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (activates Google OAuth automatically).

---

## Known Quirks

- Reminders screen not linked in BottomNav or SideNav — go to `/reminders` directly
- Demo state localStorage key is `"progress-demo-state-v1"` (legacy name; app was previously called "Progress")
- `JournalScreen.tsx` is 640+ lines — functional but would benefit from splitting phases into subcomponents if logic grows
- `JournalScreen.tsx` phase transition: `runAnalysis` `useCallback` must be declared **before** the `useEffect` that references it in deps (TS forward-reference error otherwise); the post-transcription check uses `phase === "analyzing"`, not `"recording"`
- `GEMINI_API_KEY` missing/invalid → `lib/gemini.ts` throws, route catches and silently falls back to `lib/parser.ts` regex (logged via `console.error` only)
- Never commit `.vercel/output` or pin `styled-jsx` loosely — see "Last Session" section above for why
