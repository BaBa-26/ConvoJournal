# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Progress** (repo: CProgress) — mobile-first voice journaling PWA. Users speak a daily brain-dump; the app transcribes it, parses Yesterday/Today/Tomorrow sections, extracts tasks + reminders + trackable goals, and saves to Postgres. Auth-gated for saving; unauthenticated try-mode shows demo data from localStorage. A schedule/calendar view (`/schedule`) and a Goals screen (`/tasks`, unit-based progress) sit alongside the journal. **Profile** (`/profile`) is split from **Settings** (`/settings`); the Journal tab is mic-first with "past entries" one tap away; tasks, reminders **and goals are editable — and convertible between each other — everywhere** (see 3-way conversion); the Today dashboard has task + goals tracker widgets. A marketing **landing** (`/landing`, full-bleed, own chrome) and the **circle-with-dot brand mark** (`components/BrandMark.tsx`, also the favicon/PWA icon) round it out. **Web-push notifications** (reminders + daily goal nudge) are built and env is now set, but delivery is failing 403 (stale subscription) — see Gotchas.

Recent feature work (all deployed): **AI crisis modes** (two-layer self-harm/abuse/violence/distress detection + soft-landing support card, zero-retention — `lib/crisis.ts`); **completed auto-cleanup + weekly momentum bar + goal quick-log/custom-step** (Phase 1); **3-way task↔reminder↔goal conversion** (Phase 2). **Phase 3 (per-item notifications) is the next session's work.**

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

### Completed auto-cleanup + weekly momentum bar
Completed tasks/goals hard-delete ~24h after completion (cron pass in `app/api/cron/notify`, deletes where `completed && completedAt < now-24h`) to save space + keep metrics recent — **but the accomplishment still counts.** A tiny durable `Completion` row (`{ kind, title, completedAt }`) is written on the completed transition (in the task/goal `PATCH` routes + journal auto-advance) and **outlives** the deleted row (pruned only after 60d). The Goals screen's **momentum bar** = this-week progress on live goals **plus** goals completed & cleared this week (`GET /api/completions?kind=goal&since=weekStart`), so finishing a goal keeps the bar full / shows "all clear" instead of resetting to a demoralizing 0%. In demo mode momentum is derived from live goals (`goalsDoneThisWeek`); in remote mode the count is kept in sync optimistically on each completion (no refetch).

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

### Unauthenticated try-mode
`lib/demoData.ts` seeds `localStorage` (key: `progress-demo-state-v1`) with fake entries/tasks/reminders/goals. `JournalScreen`, `TasksScreen`, `ScheduleScreen`, and `RemindersScreen` read from localStorage when no session exists. Saving prompts "Sign in to save". Journal analysis can *create* demo goals but cannot auto-advance them (see above).

### Rate limiting
`middleware.ts` uses an in-memory sliding window: 5 req/min on `/api/transcribe`, 20/min on `/api/analyze`, 60/min default. Rate limiting runs before auth checks.

### Push notifications (web-push)
Service worker `public/sw.js` shows notifications from pushes. `lib/push.ts` (client) requests permission + subscribes; `lib/webpush.ts` (server) signs/sends with VAPID and prunes dead subs. Opt-in slider lives in `components/NotificationsSettings.tsx` on the Profile page. Routes: `app/api/push/{subscribe,unsubscribe,test}` + secret-guarded `app/api/cron/notify` (fires due reminders by `eventDate`, a once-daily goal nudge at each user's `reminderTime`/`timezone`, **and the completed-item cleanup pass**). Cron config in `vercel.json` (`0 9 * * *` — Hobby caps cron at once/day). Model `PushSubscription` + `User.timezone`/`lastGoalNudge` are migrated in prod. **VAPID + `CRON_SECRET` env vars ARE now set in prod (2 days ago), but delivery fails with a `403` — the existing subscription was created against a VAPID public key that no longer pairs with the current private key.** Fix (Phase 3, next session): re-toggle the slider to re-subscribe, then "Send test" (bypasses the cron). Per-item "notify me" toggles on task/reminder/goal are **not yet built** — that's Phase 3. `enablePush` requests permission *before* the VAPID check, so the browser prompt shows on the first slider click.

### Chrome / routes
Root layout renders `SideNav` (desktop) + `BottomNav` + `ProfileButton` (mobile) around a `max-w-2xl` column. All three now hide on `/login`, `/landing`, `/onboarding` (the landing breaks out full-bleed). `app/error.tsx` (route error boundary) + `app/not-found.tsx` (themed 404) handle failures.

## Key Files

| File | Role |
|------|------|
| `lib/auth.ts` | NextAuth config + `requireAuth()` guard |
| `lib/validators.ts` | Zod schemas for all API inputs (incl. `GoalCreate/UpdateSchema`, goal fields in `JournalCreateSchema`) |
| `lib/parser.ts` | Regex Yesterday/Today/Tomorrow + task/reminder extraction (fallback; does not emit goals) |
| `lib/demoData.ts` | Demo state — `createDemoState`, `loadDemoState`, `appendDemoJournalEntry` (tasks/reminders/goals) |
| `components/JournalScreen.tsx` | 5-phase state machine + entry history (640+ lines — avoid adding top-level state) |
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
| `app/api/analyze/route.ts` | Gemini analysis with regex fallback; injects pending tasks + active goals + timezone for auth'd users |
| `app/api/journal/route.ts` | Upserts entry; creates tasks/reminders/goals; applies ownership-checked goal increments |
| `app/api/goals/route.ts`, `app/api/goals/[id]/route.ts` | Goals CRUD — auth-gated, IDOR-checked, keeps `completed` in sync + clamps `current ≤ target` |
| `middleware.ts` | Rate limiting + CSP/HSTS/security headers |
| `prisma/schema.prisma` | User, JournalEntry, Task, Reminder, **Goal**, **Completion** + NextAuth models |
| `types/index.ts` | All shared TS types (incl. `Goal`, `Completion`, `CompletionsSummary`, `ExtractedGoal`, `GoalUpdate`, `GoalPeriod`) |

## Environment Variables

```
DATABASE_URL=           # Neon pooled connection string
DIRECT_URL=             # Neon direct connection (for migrations)
GROQ_API_KEY=           # Groq Whisper transcription
NEXTAUTH_SECRET=        # generate: openssl rand -base64 32
NEXTAUTH_URL=           # http://localhost:3000 (dev) / https://... (prod)
GOOGLE_CLIENT_ID=       # from Google Cloud Console
GOOGLE_CLIENT_SECRET=   # from Google Cloud Console
GEMINI_API_KEY=         # from Google AI Studio (aistudio.google.com) — AI Studio key, not Vertex AI

# Push notifications — SET in prod (2 days ago). Delivery currently 403s (stale subscription vs current keys — see Gotchas).
# If regenerated, the public/private pair must match AND NEXT_PUBLIC_VAPID_PUBLIC_KEY must equal VAPID_PUBLIC_KEY, then redeploy (NEXT_PUBLIC is build-time inlined).
VAPID_PUBLIC_KEY=            # from `npx web-push generate-vapid-keys`
VAPID_PRIVATE_KEY=          # (secret) from the same command
NEXT_PUBLIC_VAPID_PUBLIC_KEY=  # SAME value as VAPID_PUBLIC_KEY (the client reads this)
VAPID_SUBJECT=              # mailto:you@example.com
CRON_SECRET=                # random; Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`
```

## Code Conventions

- All screen/component files are `"use client"` — Next.js App Router
- Component classes live in `globals.css`: `.btn-primary`, `.btn-ghost`, `.card`, `.card-tight`, `.input`, `.label`
- Custom colors: `ink-*` (charcoal bg), `parchment-*` (cream text), `gold` (accent), `priority-*` (task colors)
- Mobile-first, max-width 430px mobile / 2xl desktop, safe-area padding via CSS `env()`
- `SideNav` (desktop, hidden on mobile) + `BottomNav` (mobile, hidden on md+)

## Data Model Notes

- `User.onboarded: Boolean` — gates redirect to `/onboarding` on first sign-in
- One `JournalEntry` per calendar day — upserted on `{ userId, date }` unique constraint
- `Task.source`: `"journal"` | `"manual"`. `Reminder.reminded` set true once a due-reminder push fires. `Task.completedAt` / `Goal.completedAt` are stamped on the completed transition (NOT `updatedAt`, which any edit bumps) and drive the 24h auto-cleanup.
- `Goal`: `unit` (free-form counting noun, default `"times"`), `target` (int ≥1), `current` (int, 0…target), `step` (per-goal default ± increment, default 1), `period` (`"week"` | `"month"` | `"ongoing"`), `completed` (mirrors `current ≥ target`), `source` (`"journal"` | `"manual"`). No relation to `JournalEntry`.
- `Completion` (`{ kind: "task"|"goal", title, completedAt, userId }`) — a tiny durable record written when an item completes; **outlives** the heavy row's 24h auto-cleanup so the weekly momentum bar keeps crediting the win. Pruned by the cron after 60 days. Un-completing an item deletes its most-recent matching Completion.
- **Completed tasks/goals are auto-deleted ~24h after completion** by the cron cleanup pass — so the live tables only hold recent/active work; historical metrics come from `Completion`, not the heavy rows.
- All app models have `userId` FK with `onDelete: Cascade`

## Gotchas

- `RemindersScreen` is not linked in `BottomNav` or `SideNav` — only reachable at `/reminders`
- `GEMINI_API_KEY` must be set in Vercel env vars — if missing, Gemini throws and the route silently falls back to `lib/parser.ts` (logged via `console.error`)
- `JournalScreen.tsx` phase transition: `runAnalysis` `useCallback` must be declared **before** the `useEffect` that references it in its deps array (TypeScript forward-reference error otherwise)
- `phase === "analyzing"` (not `"recording"`) is the correct check in the post-transcription effect — phase is already `"analyzing"` by the time `recState` reaches `"idle"`
- `NEXTAUTH_SECRET` must be set or NextAuth throws on any session operation
- Demo state localStorage key is `"progress-demo-state-v1"` (legacy name)
- **Migrations are broken for `migrate dev`:** `prisma/migrations/migration_lock.toml` says `provider = "sqlite"` (early prototype) but the live DB is Neon Postgres, so `db:migrate` fails **P3019**. Apply schema changes with `npm run db:push`. Preview the SQL first with: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`. There is only one `DATABASE_URL`, so `db:push` writes directly to prod.
- **Goal auto-advance is auth-only.** `/api/analyze` matches "I did X" against goals it reads from the DB; demo-mode goals live in localStorage and are invisible server-side, so journal entries can create demo goals but never increment them.
- **Windows `next build` fails on `/icon`** (`@vercel/og` `fileURLToPath` Invalid URL) — a local-only quirk; the route builds fine on Vercel's Linux. Use `npx tsc --noEmit` to typecheck locally, and let Vercel build on deploy.
- **Editing an item CAN now switch task↔reminder↔goal** (was locked before — that gotcha is obsolete). Conversion creates a new row in the target table and deletes the source (`lib/itemConvert.ts`); the item's id changes. `lockType` on `ItemEditModal` only pins the toggle when *creating* from a single-kind screen, never when editing.
- **Dev sign-in uses JWT sessions, prod uses database sessions** (`useJwtSessions = NODE_ENV === "development"` in `lib/auth.ts`). The Credentials provider can't create DB sessions, so a database-strategy dev login silently no-ops → bounces to `/landing`. If you touch auth, keep the `session` callback working for BOTH strategies (`user` in DB mode, `token` in JWT mode) and keep the onboarding gate in `app/page.tsx` **DB-authoritative** (it re-checks the DB when the JWT claims not-onboarded) or dev onboarding loops.
- **The weekly momentum bar reads `GET /api/completions`** (fetched on mount). After an in-session completion the remote count is bumped optimistically in `GoalsSection.handleStep`; if you add other completion paths, keep that count in sync or the bar drops toward 0%.
- **Run `db:push` BEFORE (or with) deploying any schema change.** Deploying code whose Prisma schema added `User` columns without migrating first once broke Google sign-in in prod: NextAuth's PrismaAdapter selects *all* User columns, so the missing columns made every User query throw. The DB and code must move together.
- **Vercel Git auto-deploy is broken** since the GitHub repo was renamed (`ConvoJournal` → `Progress`); pushing no longer triggers a build. **Deploy with `npx vercel --prod --yes`** (CLI is authed as `baba-26`, project `progress`). Push to `origin` too, just to keep the repo current.
- **Notifications (Phase 3, next session):** VAPID + `CRON_SECRET` are set in prod, but a live `POST /api/cron/notify` logs `[webpush] send failed 403` — the stored subscription was created against a public key that no longer pairs with the current private key. Fix path: re-toggle the notifications slider (re-subscribe with the current key), then "Send test" (fires immediately, bypasses the cron). On iPhone push only works after Add-to-Home-Screen; Hobby cron is once/day, so for timely reminders point an external pinger (cron-job.org) at `/api/cron/notify?key=<CRON_SECRET>`. Then build the per-item "notify me" toggles (Task/Reminder/Goal `notify` fields + cron passes).
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