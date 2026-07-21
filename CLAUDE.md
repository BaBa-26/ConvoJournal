# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Progress** (repo: CProgress) — mobile-first voice journaling PWA. Users speak a daily brain-dump; the app transcribes it, parses Yesterday/Today/Tomorrow sections, extracts tasks + reminders + trackable goals, and saves to Postgres. Auth-gated for saving; unauthenticated try-mode shows demo data from localStorage. A schedule/calendar view (`/schedule`) and a Goals screen (`/tasks`, unit-based progress) sit alongside the journal. **Profile** (`/profile`) is split from **Settings** (`/settings`); the Journal tab is mic-first with "past entries" one tap away; tasks, reminders **and goals are editable — and convertible between each other — everywhere** (see 3-way conversion); the Today dashboard has task + goals tracker widgets. A marketing **landing** (`/landing`, full-bleed, own chrome) and the **circle-with-dot brand mark** (`components/BrandMark.tsx`, also the favicon/PWA icon) round it out. **Web-push notifications** (reminders + daily goal nudge) are built and env is now set, but delivery is failing 403 (stale subscription) — see Gotchas.

Recent feature work (all deployed): **AI crisis modes** (two-layer self-harm/abuse/violence/distress detection + soft-landing support card, zero-retention — `lib/crisis.ts`); **weekly momentum bar + goal quick-log/custom-step** (Phase 1); **3-way task↔reminder↔goal conversion** (Phase 2); **database-level Row-Level Security** (every user-data table enforces tenant isolation in Postgres itself — see Architecture); **security audit + hardening** (2026-07-10 — durable Upstash rate limiting on the AI paths, per-account vault isolation, CSP `unsafe-eval` dropped in prod, constant-time cron compare — see TLDR).

**Phase 0 UX repairs (on `claude/nifty-hamilton-ISukC`; typecheck-clean, COMMITTED 2026-07-20, NOT yet deployed):** **(0a)** manual add-with-due-date no longer silently 400s — a `<input type=date>` value now becomes a real instant via `lib/dates.ts` (`localDateToISO`, local noon), the server accepts bare `YYYY-MM-DD` too (`dateInput` validator + `coerceToISO`), and **every mutation surfaces failure** through a shared toast (`components/ToastProvider.tsx` + `useToast`, mounted in `app/layout.tsx`) with rollback on optimistic paths. **(0b)** one **`components/Checkbox.tsx`** (optimistic flip + rollback + disabled-in-flight + `aria-checked` + focus-visible ring) replaced the two divergent inline checkboxes in `TasksScreen`/`ScheduleScreen`. **(0c)** **completed tasks are no longer deleted** — hidden from active views 24h post-completion via a server-sent cutoff, kept forever as Phase-5 raw material (goals keep their delete-after-24h lifecycle — see Completed-item lifecycle). **(0d)** name decision: product is **Progress**, screen stays titled **"To-Do's"**, goals stay a distinct feature (no code change). **(1a)** transcription already on Groq `whisper-large-v3-turbo` (verified; removed dead `whisper-service` `.gitignore` lines). **(1b) — Phase 1b is now WRITTEN (was designed-only):** design-§7 **voice rules** (second person, never "the user"), the optional **`firstName` direct-address** (once, `tomorrow` field only — per the resolved name A/B), and the **fallback-parser timezone fix** (`lib/parser.ts` now takes a `now` reference; `/api/analyze` passes local-noon of the user's calendar day via the new `localDate` field) all landed in this commit. **(obs) — Sentry** error-monitoring + tracing wired (`instrumentation.ts`/`instrumentation-client.ts`, `sentry.server/edge.config.ts`, `withSentryConfig` in `next.config.js`, same-origin `/monitoring` tunnel so CSP is untouched): **inert until `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` are set**, `sendDefaultPii:false` (journal text never rides a stack frame).

**⏸ Parked (built + verified, NOT on this branch): Stripe billing / paywall.** A full monetization system — free-tier weekly AI quota (rolling 7-day, default 3 `analyze`/wk), anonymous one-free-try gate, Stripe Checkout (7-day trial on annual) + customer portal + signature-verified webhook, a Paywall UI, a "Plan & usage" settings tab, and a `UsageEvent` table + `User` billing columns — lives on branch **`feature/billing-paywall`** (pushed to origin; open the PR at github.com/BaBa-26/Progress). It was smoke-tested end-to-end on a Neon staging branch but is **deliberately kept off `claude/nifty-hamilton-ISukC`** until the rest of the release is ready. **The billing schema has NOT been `db:push`'d to prod** — do that (and re-apply `prisma/rls.sql` for the new `UsageEvent` table) only when merging. Two pre-launch caveats live in that branch's commit message: `STRIPE_PRICE_MONTHLY`/`STRIPE_PRICE_YEARLY` still share one Stripe price id (create a real monthly price first), and the "sync across devices" paywall bullet is app-wide, not premium-gated.

**Next session's work:** (1) **deploy the Phase 0 + 1b branch** — everything below is COMMITTED but local-only. At deploy: run `scripts/backfill-completedat.ts` + `db:push` the new `@@index([userId, completedAt])`, re-apply `prisma/rls.sql` if any table was recreated, `npx tsc --noEmit`, then `npx vercel --prod --yes` (Git auto-deploy is broken — see Gotchas). **Optionally** set `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` (+ `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` for readable stack traces) in Vercel to turn Sentry on — it's inert until then. (2) **restore the parked billing skeleton when ready** — the Phase 2 entitlements/usage skeleton (`lib/entitlements.ts`, `lib/usage.ts`, `app/api/entitlements/route.ts`, `hooks/useEntitlements.ts` + `Subscription`/`UsageEvent` models + the `/api/analyze` quota gate) was built this session but **deliberately excluded from the commit** (deploy landmine: the gate throws 500 for every authed analyze call until `UsageEvent` is `db:push`'d). It's stashed as `stash@{0}` ("parked: billing/entitlements skeleton") — `git stash show -p stash@{0}` to inspect, `git stash pop` to restore. Note this is a *newer, lighter* skeleton than the full paywall on `feature/billing-paywall`; reconcile the two before shipping billing. (3) **App-lock follow-ups (agreed 2026-07-20, deferred to next session):** (a) **delete the `/api/user/app-lock/reset` stub** — it's auth-gated and correct, but only logs; the "Email me a reset link" button currently sends nothing, which is worse than not offering it. (b) **Do NOT build email-based PIN reset** — token generation/expiry/single-use + a mailer + rate limiting is real attack surface to protect something that isn't a security boundary, and the email usually lands in an inbox already logged in on the same device. (c) **Backlog the real upgrade instead: re-auth-to-remove** (`signIn("google", { prompt: "login" })` before `clearLock`) so the PIN is backed by the account rather than just the session cookie — or **WebAuthn / platform biometrics** (Face ID, Windows Hello), which is better UX *and* better security with no recovery flow to own. (d) Decide the `progress:storageMode` + `progress:pendingEntry` namespacing question (a guest can currently flip the owner's storage to device-only, and a guest's pending entry is absorbed by the next account to sign in — the latter is by design for the earned sign-in gate, but wants an age cap + explicit confirm). (4) **HIGH-1 — upgrade Next.js off 14.2.35** (14 `npm audit` advisories, breaking major, needs a regression pass); (5) **Phase 3 per-item notifications**; (6) two remaining manual-testing bugs — local-mode (device-only) journal saves don't populate Tasks/Goals/Calendar, and a mobile crisis-support-card overlap (safety-critical, fix first). The cross-account local-data leak is **fixed** (per-account vault key). **Phase 1b is DONE** (voice/name/tz — see above). See `TLDR.md` for full detail.

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # prisma generate + next build
npm run db:push      # push schema changes to DB (USE THIS — see Gotchas)
npm run db:migrate   # ⚠ currently fails P3019 (sqlite/postgres provider mismatch) — see Gotchas
npm run db:studio    # Prisma Studio GUI
```

## Stack

- **Next.js 14** App Router · TypeScript strict · Tailwind CSS
- **Prisma 5 + Neon Postgres** (prod) — `DATABASE_URL` (pooled) + `DIRECT_URL` (migrations)
- **NextAuth v4** — Google OAuth + dev credentials provider (dev-only)
- **Groq** `whisper-large-v3-turbo` via `groq-sdk` for transcription — `GROQ_API_KEY` required
- **Gemini 2.5 Flash** via `@google/genai` (v2.x, `GoogleGenAI` client) for journal analysis — `GEMINI_API_KEY` required; falls back to `lib/parser.ts` regex on error
- Custom Trie + bigram N-gram autocomplete (`lib/autocomplete.ts`) persisted to localStorage
- **`@vercel/speed-insights`** — `<SpeedInsights/>` mounted in `app/layout.tsx` (metrics only populate on Vercel once enabled in the dashboard)
- Hosted on **Vercel** (prod alias `progress-coral-eight.vercel.app`); deploys build remotely on Linux

## Architecture

### Auth flow
`lib/auth.ts` — `authOptions` wires NextAuth with PrismaAdapter. `requireAuth()` is called at the top of every data API route and returns `{ userId }` or a `NextResponse 401`. All DB queries are scoped to `userId`.

- Google OAuth is active when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set — no code changes needed.
- Dev credentials provider is only included when `NODE_ENV === "development"`.
- **Session strategy is env-dependent:** `"database"` in production (Google OAuth), `"jwt"` in development. The Credentials provider CANNOT create DB sessions (adapter only persists OAuth/email sessions), so dev must use JWT or sign-in silently no-ops. The `jwt` callback re-reads `onboarded`/`displayName` from the DB on `update()`. `user.id` is injected into the session via the `session` callback (works for both strategies).
- **First-run onboarding fires from any entry point.** All sign-in paths land on `/`, which enforces onboarding **server-side and DB-authoritative** (`app/page.tsx`): when the session claims `onboarded === false` it confirms against the DB before redirecting, so a stale JWT can't cause a loop. Onboarding completes with a hard navigation + self-heals (`/onboarding` bounces already-onboarded users to `/`). Client-side `AuthProvider` still guards deep-links.

### Data flow — journal entry
`JournalScreen` (5-phase state machine) → `POST /api/transcribe` (Groq Whisper, no auth) → `POST /api/analyze` (Gemini 2.5 Flash, no auth required but injects pending-task context + the user's active goals if a session exists) → `POST /api/journal` (auth required, upserts by `userId + date`). Tasks, reminders, **and goals** are created in the same `POST /api/journal` call, and goal-progress increments are applied there too.

### Goals extraction & tracking
`Goal` = a countable target over a period (`unit`/`target`/`current`/`period`). Two AI-driven behaviors in `lib/gemini.ts`:
1. **Create** — "gym every day this week" → `{ unit: "days", target: 7, period: "week" }` in `analysis.goals`.
2. **Auto-advance** — `/api/analyze` passes the auth'd user's active goals to Gemini; "went to the gym today" returns `analysis.goalUpdates` (`{ goalId, increment }`). **Hallucinated/forged goal IDs are filtered server-side** against the user's real active-goal IDs; `/api/journal` re-checks ownership (`findFirst({ id, userId })`) before incrementing. Auto-advance is **auth-only** (demo mode has no server-side goals to match).

Goals CRUD lives at `/api/goals` + `/api/goals/[id]` (auth-gated, IDOR-checked). UI is `components/GoalsSection.tsx`, rendered atop the Goals screen (`components/TasksScreen.tsx`). Each goal has a `step` (per-goal default ± increment); goal cards expose an editable amount for quick "log N at once" (e.g. +30 pages).

### Completed-item lifecycle + weekly momentum bar
**Tasks are NEVER deleted (Phase 0c).** A completed task leaves *active views* ~24h after completion but stays in the DB forever — `Task.completedAt` is Phase-5 raw material (completion ratio, momentum ribbon), so deleting it would destroy the thing the premium tier is made of. The hide is a **per-surface client filter against a server-computed cutoff**: `GET /api/tasks` returns *every* task (the Tasks **"completed" tab is the full archive**) plus an **`x-completed-cutoff`** response header (server `now − 24h`); `lib/completed.ts` (`readCompletedCutoff`, `isTaskCleared`) applies it to the Tasks **"all"** view + the schedule **day panel** + **upcoming feed** (`isReminderCleared` hides past+fired reminders there too). Pending/"completed" views are unaffected.

**Goals STILL hard-delete ~24h after completion** — the Goals screen renders every goal it's given, so undeleted completed goals would pile up. The cron (`app/api/cron/notify`) deletes `goal` rows where `completed && completedAt < now-24h` and prunes `Completion` rows past 60d; it **no longer deletes tasks**. A tiny durable `Completion` row (`{ kind, title, completedAt }`) written on the completed transition **outlives** a deleted goal so the momentum bar still credits it. The Goals screen's **momentum bar** = this-week progress on live goals **plus** goals completed & cleared this week (`GET /api/completions?kind=goal&since=weekStart`). Demo mode derives momentum from live goals (`goalsDoneThisWeek`); remote mode keeps the count in sync optimistically on each completion.

`scripts/backfill-completedat.ts` seeds `completedAt = updatedAt` for legacy completed rows (owner role, spans all users) — **NOT yet run**; and `@@index([userId, completedAt])` on Task is in schema but **needs `db:push`**. Neither is required for the hide to work going forward.

### 3-way category conversion (task ↔ reminder ↔ goal)
`components/ItemEditModal.tsx` is a unified editor for all three kinds; the type toggle is **unlocked in edit mode** (`lockType` still pins it when *creating* from a single-kind screen). Converting = create a fresh row in the target table, delete the source (`lib/itemConvert.ts` — `convertItemRemote` for REST, `convertItemDemo` for localStorage). Wired into `TasksScreen`, `ScheduleScreen`, and `GoalsSection` (goal editing now uses the shared modal). No cross-component refresh needed: the Goals tab and task list render mutually exclusively, so a converted item shows fresh when its destination view mounts.

### Crisis modes (safety)
`lib/crisis.ts` — a two-layer detector (deterministic keyword tiers + Gemini STEP-5 semantic classification, merged via `mergeRisk`). `/api/analyze` runs the deterministic layer on **every** path (so coverage survives a Gemini outage) and strips any extracted task/reminder/goal that IS the crisis phrasing (`filterCrisisActionables` — "I want to die" never becomes a task "Die"). `components/CrisisSupportCard.tsx` shows static-copy-only resources above the review screen; **zero-retention** — the risk signal is never persisted (Zod strips it; `stripRisk` on client paths). Fixtures in `scripts/parser-check.ts` (`npm run test:parser`).

### AI extraction guardrails & cost
`lib/gemini.ts` — everything below treats the transcript as untrusted:
- **Prompt-injection defense** — the system prompt fences the entry as data; `INJECTION_RE` matches override *phrasing* (not lone words like "ignore", which appear in legit journaling). It (a) drops poisoned task/goal titles via `sanitizeTitle` and (b) re-asserts the data boundary in the prompt when the transcript itself reads like an override. `sanitizeField` scrubs the four narrative fields; `sanitizeTitle` also strips leaked fence tokens (`[Journal Entry]` etc.).
- **Forged-goal-ID filtering** — `goalUpdates` are kept only when `goalId` ∈ the user's active-goal set; `/api/journal` re-checks ownership before writing.
- **Cost/latency** — the `generateContent` config sets `thinkingConfig: { thinkingBudget: 0 }` (thinking is billed at the output rate and adds ~5s on schema-constrained extraction), `maxOutputTokens: 2048`, and `temperature: 0` (deterministic). `/api/analyze` injects at most 25 pending task titles + 20 active goals. Warm `/api/analyze` ≈ 1s. Pricing (Jul 2026): 2.5 Flash $0.30/$2.50 per 1M in/out; Flash-Lite is ~3–6× cheaper if a future A/B shows it holds extraction quality.

### Schedule / calendar
`components/ScheduleScreen.tsx` (`/schedule`) — month calendar with task/reminder dots, a day panel, and an "upcoming" feed. Tasks and reminders are **editable inline** via the shared `ItemEditModal` (title/date/time/priority/notes). The type toggle is **no longer locked** — editing an item can convert it between task/reminder/goal (see 3-way conversion); the row re-homes to the target table on save.

### Error surfacing (Phase 0a)
No silent failures. `components/ToastProvider.tsx` (mounted in `app/layout.tsx`) exposes `useToast()` → `toast(msg)`; **every mutation fetch** in `TasksScreen`/`ScheduleScreen`/`RemindersScreen`/`JournalScreen` has a non-`res.ok` branch + a `catch`, both calling `toast(...)` with in-brand lowercase second-person copy. Optimistic handlers snapshot state before mutating and roll back on failure (the `Checkbox` owns its own visual rollback). `JournalScreen.handleSave` now checks `res.ok` so a rejected save no longer flips the UI to "saved". **If you add a fetch, follow this pattern.**

### Dates (Phase 0a)
`lib/dates.ts` is the single path from a date/time picker to an API. `localDateToISO(dateStr, timeStr?)` (client) turns a bare `<input type=date>`/`time` value into a real instant anchored to **local noon** (UTC-midnight would render as the previous day west of Greenwich, and an empty time used to throw). `coerceToISO(value)` (server) accepts a full RFC-3339 string **or** a bare `YYYY-MM-DD` → ISO, used in the task/reminder POST+PATCH routes; the `dateInput` Zod schema (in `lib/validators.ts`) accepts both formats so a stray bare date never 400s.

### Unauthenticated try-mode
`lib/demoData.ts` seeds `localStorage` (key: `progress-demo-state-v1`) with fake entries/tasks/reminders/goals. `JournalScreen`, `TasksScreen`, `ScheduleScreen`, and `RemindersScreen` read from localStorage when no session exists. Saving prompts "Sign in to save". Journal analysis can *create* demo goals but cannot auto-advance them (see above).

### Rate limiting
`middleware.ts` has two layers. (1) In-memory sliding window (per serverless instance): 5 req/min on `/api/transcribe`, 5/min on `/api/analyze`, 60/min default. (2) **Durable Upstash Redis layer** (cross-instance — the one that actually holds on Vercel) on the two billable AI paths only: 5/min per IP + 200/hour global. Fail-open by design: if `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are unset (local dev) or Redis errors, requests fall back to the in-memory layer; provider spend caps (Gemini cap set, Groq free tier hard-stops) bound the worst case. Rate limiting runs before auth checks.

### Push notifications (web-push)
Service worker `public/sw.js` shows notifications from pushes. `lib/push.ts` (client) requests permission + subscribes; `lib/webpush.ts` (server) signs/sends with VAPID and prunes dead subs. Opt-in slider lives in `components/NotificationsSettings.tsx` on the Profile page. Routes: `app/api/push/{subscribe,unsubscribe,test}` + secret-guarded `app/api/cron/notify` (fires due reminders by `eventDate`, a once-daily goal nudge at each user's `reminderTime`/`timezone`, **and the cleanup pass — now GOALS-only delete + `Completion` prune; it no longer deletes tasks**, see Completed-item lifecycle). Cron config in `vercel.json` (`0 9 * * *` — Hobby caps cron at once/day). Model `PushSubscription` + `User.timezone`/`lastGoalNudge` are migrated in prod. **VAPID + `CRON_SECRET` env vars ARE now set in prod (2 days ago), but delivery fails with a `403` — the existing subscription was created against a VAPID public key that no longer pairs with the current private key.** Fix (Phase 3, next session): re-toggle the slider to re-subscribe, then "Send test" (bypasses the cron). Per-item "notify me" toggles on task/reminder/goal are **not yet built** — that's Phase 3. `enablePush` requests permission *before* the VAPID check, so the browser prompt shows on the first slider click.

### Chrome / routes
Root layout renders `SideNav` (desktop) + `BottomNav` + `ProfileButton` (mobile) around a `max-w-2xl` column. All three now hide on `/login`, `/landing`, `/onboarding` (the landing breaks out full-bleed). `app/error.tsx` (route error boundary) + `app/not-found.tsx` (themed 404) handle failures.

### Row-Level Security (RLS)
Every user-data table (`JournalEntry`, `Task`, `Reminder`, `Goal`, `Completion`, `PushSubscription`) has Postgres RLS enabled with a `tenant_isolation` policy, so isolation is enforced by the database, not just by app code remembering `where: { userId }`. `lib/prisma.ts` exports three things: `prisma` (base client, runs as the restricted `app_runtime` role — used directly only for the un-RLS'd NextAuth tables), `forUser(userId)` (wraps every query in a transaction that first runs `set_config('app.user_id', userId, true)` — **every** user-scoped route uses this), and `prismaAdmin` (owner role via `ADMIN_DATABASE_URL`, bypasses RLS — reserved for `app/api/cron/notify` and `lib/webpush.ts`, which legitimately span all users). Policies live in `prisma/rls.sql`, applied manually (not part of `db:push`) — **re-run it after any `db:push` that recreates a table**, since `db:push` doesn't know about the grants/policies and drops them. `scripts/rls-verify.ts` is a read-only structural check safe to run against prod at any time.

⚠️ **Never create the `app_runtime` role via the Neon console.** The console's "New Role" wizard grants `BYPASSRLS` + `neon_superuser` membership, and once created that way, **not even the database owner can undo it** (`ALTER ROLE`/`REVOKE` both fail with permission denied — Neon reserves admin on that group to itself). A role created via the console silently ignores every RLS policy. Always `CREATE ROLE app_runtime WITH LOGIN PASSWORD '...'` via plain SQL as the owner instead (see the GOTCHA comment at the top of `prisma/rls.sql`). Full story in `TLDR.md`.

## Key Files

| File | Role |
|------|------|
| `lib/auth.ts` | NextAuth config + `requireAuth()` guard |
| `lib/validators.ts` | Zod schemas for all API inputs (incl. `GoalCreate/UpdateSchema`; `dateInput` accepts RFC-3339 **or** bare `YYYY-MM-DD`) |
| `lib/dates.ts` | `localDateToISO` (picker → local-noon ISO, client) + `coerceToISO` (bare-date-safe, server) — every `type=date` value routes through these |
| `lib/completed.ts` | 24h active-view hide — `readCompletedCutoff` (from `x-completed-cutoff` header), `isTaskCleared`, `isReminderCleared` |
| `components/Checkbox.tsx` | The one task checkbox — optimistic flip, rollback on failure, disabled-in-flight, `aria-checked`, focus-visible ring |
| `components/ToastProvider.tsx` | `useToast()` — failure surfacing for every mutation; mounted in `app/layout.tsx` |
| `scripts/backfill-completedat.ts` | One-time `completedAt = updatedAt` backfill for legacy completed rows (owner role; run at deploy, not yet run) |
| `lib/parser.ts` | Regex Yesterday/Today/Tomorrow + task/reminder extraction (Gemini fallback; no goals; ⚠ chrono still uses UTC `new Date()` — tz fix pending in 1b) |
| `lib/demoData.ts` | Demo state — `createDemoState`, `loadDemoState`, `appendDemoJournalEntry` (tasks/reminders/goals) |
| `components/JournalScreen.tsx` | Journal state machine + persistence/recovery ONLY — presentation lives in `components/journal/*` (IdlePhase, WritingPhase, RecordingPhase, AnalyzingPhase, ReviewPhase, EntriesList, EntryDetail, AttachRow) |
| `lib/attachments.ts` | Attachment processing (image downscale → data URL) + on-device persistence; server blob contract documented inline (not yet provisioned) |
| `components/TodayScreen.tsx` | Home dashboard — greeting, agenda, quick links |
| `components/TasksScreen.tsx` | Goals screen — renders `GoalsSection` then the task list |
| `components/GoalsSection.tsx` | Self-contained goals UI — per-goal progress + step/quick-log, **weekly momentum bar**, goal edit/convert via shared modal, demo + optimistic |
| `components/ItemEditModal.tsx` | Unified task/reminder/goal editor; unlocked type toggle drives 3-way conversion |
| `lib/itemConvert.ts` | Category conversion — `convertItemRemote` (REST) / `convertItemDemo` (localStorage): create target row + delete source |
| `lib/crisis.ts` | Crisis detector — `detectCrisisSignals`, `mergeRisk`, `filterCrisisActionables`, `stripRisk`, static resources (zero-retention) |
| `app/api/completions/route.ts` | This-week completion count for the momentum bar (auth-gated) |
| `components/ScheduleScreen.tsx` | Calendar + day panel + upcoming feed; editable tasks/reminders, convertible via `ItemEditModal` |
| `app/api/transcribe/route.ts` | Groq Whisper (public) — MIME allowlist, 25 MB cap |
| `lib/gemini.ts` | Gemini client — `analyzeWithGemini()`; extracts tasks/reminders/goals/goalUpdates; prompt-injection defense, forged-goal-ID filtering, safety settings, fallback-safe |
| `app/api/analyze/route.ts` | Gemini analysis with regex fallback; injects pending tasks + active goals; resolves `todayISO` in the client's tz for the Gemini path (fallback path not yet tz-corrected) |
| `app/api/tasks/route.ts` | Tasks list/create; GET emits the `x-completed-cutoff` header (server `now−24h`) for the active-view hide |
| `app/api/journal/route.ts` | Upserts entry; creates tasks/reminders/goals; applies ownership-checked goal increments |
| `app/api/goals/route.ts`, `app/api/goals/[id]/route.ts` | Goals CRUD — auth-gated, IDOR-checked, keeps `completed` in sync + clamps `current ≤ target` |
| `middleware.ts` | Rate limiting + CSP/HSTS/security headers |
| `prisma/schema.prisma` | User, JournalEntry, Task, Reminder, **Goal**, **Completion** + NextAuth models |
| `types/index.ts` | All shared TS types (incl. `Goal`, `Completion`, `CompletionsSummary`, `ExtractedGoal`, `GoalUpdate`, `GoalPeriod`) |
| `lib/prisma.ts` | `prisma` (base, `app_runtime` role) / `forUser(userId)` (RLS-scoped, use for all user-data queries) / `prismaAdmin` (owner, cron + webpush only) |
| `prisma/rls.sql` | RLS policies + grants for `app_runtime` — apply manually via `scripts/rls-apply.ts`, re-apply after any `db:push` |
| `scripts/rls-verify.ts` | Read-only structural RLS check — safe to run against prod |

## Environment Variables

```
DATABASE_URL=           # Neon pooled connection string — the app_runtime role (RLS-restricted)
DIRECT_URL=             # Neon direct connection, OWNER role (for migrations / db:push)
ADMIN_DATABASE_URL=     # Neon pooled connection, OWNER role — prismaAdmin (cron + webpush, bypasses RLS)
GROQ_API_KEY=           # Groq Whisper transcription
NEXTAUTH_SECRET=        # generate: openssl rand -base64 32
NEXTAUTH_URL=           # http://localhost:3000 (dev) / https://... (prod)
GOOGLE_CLIENT_ID=       # from Google Cloud Console
GOOGLE_CLIENT_SECRET=   # from Google Cloud Console
GEMINI_API_KEY=         # from Google AI Studio (aistudio.google.com) — AI Studio key, not Vertex AI

# Durable rate limiting (optional but recommended in prod) — Upstash Redis free tier.
# Unset = middleware falls back to per-instance in-memory limits only (fail-open).
UPSTASH_REDIS_REST_URL=    # from console.upstash.com or the Vercel Marketplace integration
UPSTASH_REDIS_REST_TOKEN=  # (secret) same place

# Push notifications — SET in prod (2 days ago). Delivery currently 403s (stale subscription vs current keys — see Gotchas).
# If regenerated, the public/private pair must match AND NEXT_PUBLIC_VAPID_PUBLIC_KEY must equal VAPID_PUBLIC_KEY, then redeploy (NEXT_PUBLIC is build-time inlined).
VAPID_PUBLIC_KEY=            # from `npx web-push generate-vapid-keys`
VAPID_PRIVATE_KEY=          # (secret) from the same command
NEXT_PUBLIC_VAPID_PUBLIC_KEY=  # SAME value as VAPID_PUBLIC_KEY (the client reads this)
VAPID_SUBJECT=              # mailto:you@example.com
CRON_SECRET=                # random; Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`

# Sentry (error monitoring + tracing) — inert until the DSN is set (SDK configs no-op without it).
# Org `progress-4x`, project `javascript-nextjs`. DSN is client-exposed by design (not a secret);
# set NEXT_PUBLIC_SENTRY_DSN and SENTRY_DSN to the SAME value. Browser events tunnel through the
# same-origin /monitoring route (see next.config.js) so CSP `connect-src 'self'` needs no change.
NEXT_PUBLIC_SENTRY_DSN=     # from progress-4x.sentry.io → project Settings → Client Keys (DSN)
SENTRY_DSN=                 # same value as NEXT_PUBLIC_SENTRY_DSN
SENTRY_ORG=progress-4x      # only for source-map upload at build time
SENTRY_PROJECT=javascript-nextjs
SENTRY_AUTH_TOKEN=          # (secret) source-map upload — set in Vercel/CI only; build skips upload when unset
```

## Code Conventions

- All screen/component files are `"use client"` — Next.js App Router
- **Design system ("Lamplight") lives in `docs/design-system.md`** — tokens, component specs with states, a11y contract, native-migration notes. It supersedes the token tables in `app/desingn.md`. Screens consume tokens + component classes + `components/ui/` primitives; raw hex in screen code is a defect.
- Component classes live in `globals.css`: `.btn-primary`, `.btn-ghost`, `.btn-quiet`, `.btn-danger`, `.icon-btn`, `.icon-btn-accent`, `.row-action` (44px row edit/delete hits), `.card`, `.card-tight`, `.card-interactive`, `.input`, `.label`, `.pill-mood`, `.chip`, `.badge-count`, `.seg`/`.seg-item`/`.seg-item-active`, `.banner-error`, `.action-bar` (sticky footer WITH scrim — content never reads through it)
- UI primitives in `components/ui/`: `SectionCard` (time-tinted, editable), `EmptyState` (Voice italic line), `Toggle`, `RecordButton` (idle/recording/processing/denied), `AttachmentTile`; plus level-driven `components/Waveform.tsx`
- Custom colors: `ink-*` (charcoal bg, flips in light mode), `parchment-*` (cream text, flips), `accent-*` (user preset; `accent-ink` = text-safe variant that deepens in light mode — use for accent-colored TEXT), `gold` (fixed brand chrome only — in-app interactive color is `accent`), `priority-*`, `tint-past/now/next` (+ `-label`) — warm Yesterday/Today/Tomorrow section tints
- Type roles in Tailwind fontSize: `label/meta/body/body-lg` (mono interface) and `voice-sm/voice/voice-lg/voice-xl/numeral` (Playfair "Voice" — these multiply by the user's `--type-scale`). Screen titles: `font-display italic text-voice`, sentence case.
- Motion: `duration-quick/gentle/calm`, `animate-rise` (staggered payoff, use `animationDelay`), `animate-breathe` (record halo). Reduced-motion is handled globally in `globals.css` — never opt out.
- Mobile-first, max-width 430px mobile / 2xl desktop, safe-area padding via CSS `env()`
- `SideNav` (desktop, hidden on mobile) + `BottomNav` (mobile, hidden on md+). The `/tasks` tab is named **Goals** everywhere (never "To-Do's").

## Data Model Notes

- `User.onboarded: Boolean` — gates redirect to `/onboarding` on first sign-in
- One `JournalEntry` per calendar day — upserted on `{ userId, date }` unique constraint
- `Task.source`: `"journal"` | `"manual"`. `Reminder.reminded` set true once a due-reminder push fires. `Task.completedAt` / `Goal.completedAt` are stamped on the completed transition (NOT `updatedAt`, which any edit bumps). **`Task.completedAt` drives the 24h active-view HIDE (tasks are never deleted); `Goal.completedAt` drives the 24h DELETE (goals only).** `Task` has `@@index([userId, completedAt])` for Phase-5 completion queries — **in schema, needs `db:push`**.
- `Goal`: `unit` (free-form counting noun, default `"times"`), `target` (int ≥1), `current` (int, 0…target), `step` (per-goal default ± increment, default 1), `period` (`"week"` | `"month"` | `"ongoing"`), `completed` (mirrors `current ≥ target`), `source` (`"journal"` | `"manual"`). No relation to `JournalEntry`.
- `Completion` (`{ kind: "task"|"goal", title, completedAt, userId }`) — a tiny durable record written when an item completes; for goals it **outlives** the row's 24h delete so the momentum bar keeps crediting the win. Pruned by the cron after 60 days. Un-completing an item deletes its most-recent matching Completion. (Now partly redundant for tasks, which are no longer deleted — left in place; not removed.)
- **Completed GOALS are auto-deleted ~24h after completion** (cron); **completed TASKS are NEVER deleted** — hidden from active views instead (see Completed-item lifecycle). Phase-5 metrics come from live `Task.completedAt` rows (tasks) / `Completion` rows (cleared goals).
- All app models have `userId` FK with `onDelete: Cascade`

## Gotchas

- `RemindersScreen` is not linked in `BottomNav` or `SideNav` — only reachable at `/reminders`
- `GEMINI_API_KEY` must be set in Vercel env vars — if missing, Gemini throws and the route silently falls back to `lib/parser.ts` (logged via `console.error`)
- `JournalScreen.tsx` phase transition: `runAnalysis` `useCallback` must be declared **before** the `useEffect` that references it in its deps array (TypeScript forward-reference error otherwise)
- `phase === "analyzing"` (not `"recording"`) is the correct check in the post-transcription effect — phase is already `"analyzing"` by the time `recState` reaches `"idle"`
- **Journal flows (2026-07 redesign):** plain ("save as-is" / "as spoken") entries skip extraction entirely — an entry with empty analysis IS a plain entry, no schema flag. Plain saves from the writing surface run the deterministic crisis layer client-side (`detectCrisisSignals`) so safety coverage doesn't depend on choosing the parsed flow. Analysis failure returns the user's words to the writing surface (never a dead-end spinner; 20s watchdog). Mic denial renders a designed idle variant (`micDenied`), not an error banner. `startRecording()` now returns a boolean — don't advance phase before it resolves true.
- **Attachments are device-local for now** (no server blob store): local/vault entries carry them inline; sync-mode entries store them in a per-account localStorage overlay keyed by entry date (`lib/attachments.ts`), merged back in `JournalScreen`. Images are downscaled to ≤1280px JPEG. Cap: 4/entry. When a blob store is provisioned, swap `dataUrl` for `url` per the contract in `lib/attachments.ts`.
- **`POST /api/journal` dedupes same-day re-saves** — re-analyzing the same date skips tasks/reminders already created for that entry (by title) and active journal-sourced goals (by title). One entry per day still means a second save REPLACES the day's narrative (pre-existing upsert semantics — a real product decision if multi-entry days are ever wanted).
- `NEXTAUTH_SECRET` must be set or NextAuth throws on any session operation
- Demo state localStorage key is `"progress-demo-state-v1"` (legacy name)
- **Migrations are broken for `migrate dev`:** `prisma/migrations/migration_lock.toml` says `provider = "sqlite"` (early prototype) but the live DB is Neon Postgres, so `db:migrate` fails **P3019**. Apply schema changes with `npm run db:push`. Preview the SQL first with: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`. There is only one `DATABASE_URL`, so `db:push` writes directly to prod.
- **Goal auto-advance is auth-only.** `/api/analyze` matches "I did X" against goals it reads from the DB; demo-mode goals live in localStorage and are invisible server-side, so journal entries can create demo goals but never increment them.
- **Windows `next build` fails on `/icon`** (`@vercel/og` `fileURLToPath` Invalid URL) — a local-only quirk; the route builds fine on Vercel's Linux. Use `npx tsc --noEmit` to typecheck locally, and let Vercel build on deploy.
- **Editing an item CAN now switch task↔reminder↔goal** (was locked before — that gotcha is obsolete). Conversion creates a new row in the target table and deletes the source (`lib/itemConvert.ts`); the item's id changes. `lockType` on `ItemEditModal` only pins the toggle when *creating* from a single-kind screen, never when editing.
- **Dev sign-in uses JWT sessions, prod uses database sessions** (`useJwtSessions = NODE_ENV === "development"` in `lib/auth.ts`). The Credentials provider can't create DB sessions, so a database-strategy dev login silently no-ops → bounces to `/landing`. If you touch auth, keep the `session` callback working for BOTH strategies (`user` in DB mode, `token` in JWT mode) and keep the onboarding gate in `app/page.tsx` **DB-authoritative** (it re-checks the DB when the JWT claims not-onboarded) or dev onboarding loops.
- **The weekly momentum bar reads `GET /api/completions`** (fetched on mount). After an in-session completion the remote count is bumped optimistically in `GoalsSection.handleStep`; if you add other completion paths, keep that count in sync or the bar drops toward 0%.
- **Completed TASKS are never deleted (Phase 0c) — do NOT re-add a task delete to the cron.** They're hidden from active views via the `x-completed-cutoff` header + `lib/completed.ts`; the Tasks "completed" tab is the permanent archive. Completed GOALS *are* still deleted 24h post-completion (the Goals screen would otherwise pile them up). Deleting a completed task would destroy Phase-5's raw material.
- **Route date-picker values through `lib/dates.ts`.** A raw `<input type=date>` value (`"2026-07-16"`) is not RFC-3339 — it used to 400 `TaskCreateSchema` and get swallowed by `if(res.ok){}` with no `else`. Use `localDateToISO` (local noon — UTC midnight day-shifts west of Greenwich) on the client; the server accepts both formats via `dateInput` + `coerceToISO`.
- **No silent mutation failures (Phase 0a).** Every screen fetch has a non-`res.ok` branch + `catch` → `toast(...)` (`useToast`), and optimistic paths snapshot + roll back. Follow the pattern for any new fetch. `JournalScreen.handleSave` checks `res.ok` — a rejected save must not show "saved".
- **ALL client-side storage must be namespaced per account.** This bug class has now bitten three times: the local vault (fixed 2026-07-10), and the **app lock + autocomplete model (fixed 2026-07-20)**. An origin-global `localStorage` key means a signed-out guest can write state that harms the real account owner on that browser — a guest-set PIN locked out the owner, and the journal-trained autocomplete model surfaced one person's private words as another's suggestions. Pattern: scope by account id (`vaultKey()`, `lockKey(userId)`, `lsKey()`), give signed-out visitors either nothing or a `:guest` scope, and **delete** any legacy global key rather than migrating it (its contents have no trustworthy owner). Remaining un-namespaced keys — `progress:storageMode` and `progress:pendingEntry` — are deliberate but need a design decision (see next-session work).
- **The app lock is casual-snoop protection, NOT a security boundary.** It's a device-local SHA-256 hash guarding data already reachable by anyone with an unlocked, signed-in device. Recovery is deliberately session-based: holding a valid session for that account is the identity proof. Do NOT re-add a path that lifts the lock without a session — the old "Forgot your PIN?" button faked the lockout state (`setAttempts(MAX_ATTEMPTS)`), which exposed "Remove lock" to anyone holding the device: a two-click bypass.
- **Phase 1b is DONE (committed 2026-07-20).** `lib/gemini.ts` now enforces design-§7 voice rules (second person, never "the user") + the optional `firstName` direct-address (once, `tomorrow` field only). The **fallback-parser tz fix** landed too: `parseJournalEntry(text, now?)` takes a reference instant, and `/api/analyze` passes local-noon of the user's calendar day (from the new `localDate` request field, else the IANA `timezone`, else UTC) — so a fallback "tomorrow" at night no longer lands on the wrong day.
- **Run `db:push` BEFORE (or with) deploying any schema change.** Deploying code whose Prisma schema added `User` columns without migrating first once broke Google sign-in in prod: NextAuth's PrismaAdapter selects *all* User columns, so the missing columns made every User query throw. The DB and code must move together.
- **Vercel Git auto-deploy is broken** since the GitHub repo was renamed (`ConvoJournal` → `Progress`); pushing no longer triggers a build. **Deploy with `npx vercel --prod --yes`** (CLI is authed as `baba-26`, project `progress`). Push to `origin` too, just to keep the repo current.
- **Notifications (Phase 3, next session):** VAPID + `CRON_SECRET` are set in prod, but a live `POST /api/cron/notify` logs `[webpush] send failed 403` — the stored subscription was created against a public key that no longer pairs with the current private key. Fix path: re-toggle the notifications slider (re-subscribe with the current key), then "Send test" (fires immediately, bypasses the cron). On iPhone push only works after Add-to-Home-Screen; Hobby cron is once/day, so for timely reminders point an external pinger (cron-job.org) at `/api/cron/notify?key=<CRON_SECRET>`. Then build the per-item "notify me" toggles (Task/Reminder/Goal `notify` fields + cron passes).
- **Never create the `app_runtime` (RLS) role via the Neon console.** It grants `BYPASSRLS` + `neon_superuser` membership that not even the owner can later strip. Always `CREATE ROLE app_runtime WITH LOGIN PASSWORD '...'` via plain SQL. See the "Row-Level Security" architecture section above and `prisma/rls.sql`'s header comment for the full story.
- **`npx vercel --prod` deploys the local working directory, not committed git state.** An uncommitted script once broke a prod build with a type error `tsc --noEmit` hadn't caught (written after the last local typecheck). Re-run `npx tsc --noEmit` immediately before any `vercel --prod` if files were added since the last check.
- **`prisma/rls.sql` must be re-applied after any `db:push` that recreates a table** — `db:push` doesn't know about the RLS grants/policies and drops them when it rebuilds a table. Run `scripts/rls-apply.ts` (or `scripts/rls-verify.ts` first, to check if it's actually needed).
- **Bugs found in manual testing (see TLDR.md for detail):** (1) "this device only" journal saves don't populate Tasks/Goals/Calendar (save goes to localStorage, those screens read from the server) — **still open**; (2) ~~local entries leak across accounts on the same browser~~ — **FIXED 2026-07-10**: the vault key is now namespaced per account (`vaultKey()` in `lib/localStore.ts`); (3) mobile UI: the crisis-support card's "keep on device" toggle overlaps the Discard/Save buttons — **still open, fix first** (safety-critical flow).
## 🛑 CRITICAL GUARDRAILS & SECURITY BEHAVIOR

### 1. Security & Data Protection
* **No Credential Leaks:** NEVER output, generate, or suggest real API keys, passwords, private cryptographic keys, or credentials. If requested, always use placeholders like `YOUR_API_KEY_HERE`.
* **Safe Code Execution:** Do not write, optimize, or assist with malicious payloads, exploits, or social engineering scripts. 
* **Data Privacy:** Treat all conversation context as strictly confidential. Do not suggest uploading sensitive proprietary data to unverified third-party tools.

### 2. Strict Truthfulness & Anti-Hallucination
* **Acknowledge Ignorance:** If you do not know an answer, lack sufficient context, or lack the data to verify a fact, state: "I do not have enough information to answer this reliably" instead of guessing or fabricating details.
* **No Fake Citations:** Never invent URLs, library documentation, API endpoints, or source citations. If a library or tool does not exist, explicitly state that it doesn't exist.
* **Admit Limitations:** Clearly state any assumptions you are making when solving complex technical problems.

### 3. Behavioral Boundaries
* **Direct and Peer-like Tone:** Avoid preachy, overly formal, or lecture-like language. Treat the user as a peer.
* **No Unauthorized Scope Creep:** Stick strictly to the user's explicit prompt. Do not add patronizing disclaimers about "the importance of security" when writing standard, safe code.