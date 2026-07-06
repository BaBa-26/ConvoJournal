# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Progress** (repo: CProgress) — mobile-first voice journaling PWA. Users speak a daily brain-dump; the app transcribes it, parses Yesterday/Today/Tomorrow sections, extracts tasks + reminders + trackable goals, and saves to Postgres. Auth-gated for saving; unauthenticated try-mode shows demo data from localStorage. A schedule/calendar view (`/schedule`) and a Goals screen (`/tasks`, unit-based progress) sit alongside the journal.

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
- After first Google sign-in, users are redirected to `/onboarding` (checked via `User.onboarded`). Subsequent logins go to `/`.
- Session strategy is `"database"`. `user.id` is injected into the session via the `session` callback.

### Data flow — journal entry
`JournalScreen` (5-phase state machine) → `POST /api/transcribe` (Groq Whisper, no auth) → `POST /api/analyze` (Gemini 2.5 Flash, no auth required but injects pending-task context + the user's active goals if a session exists) → `POST /api/journal` (auth required, upserts by `userId + date`). Tasks, reminders, **and goals** are created in the same `POST /api/journal` call, and goal-progress increments are applied there too.

### Goals extraction & tracking
`Goal` = a countable target over a period (`unit`/`target`/`current`/`period`). Two AI-driven behaviors in `lib/gemini.ts`:
1. **Create** — "gym every day this week" → `{ unit: "days", target: 7, period: "week" }` in `analysis.goals`.
2. **Auto-advance** — `/api/analyze` passes the auth'd user's active goals to Gemini; "went to the gym today" returns `analysis.goalUpdates` (`{ goalId, increment }`). **Hallucinated/forged goal IDs are filtered server-side** against the user's real active-goal IDs; `/api/journal` re-checks ownership (`findFirst({ id, userId })`) before incrementing. Auto-advance is **auth-only** (demo mode has no server-side goals to match).

Goals CRUD lives at `/api/goals` + `/api/goals/[id]` (auth-gated, IDOR-checked). UI is `components/GoalsSection.tsx`, rendered atop the Goals screen (`components/TasksScreen.tsx`).

### AI extraction guardrails & cost
`lib/gemini.ts` — everything below treats the transcript as untrusted:
- **Prompt-injection defense** — the system prompt fences the entry as data; `INJECTION_RE` matches override *phrasing* (not lone words like "ignore", which appear in legit journaling). It (a) drops poisoned task/goal titles via `sanitizeTitle` and (b) re-asserts the data boundary in the prompt when the transcript itself reads like an override. `sanitizeField` scrubs the four narrative fields; `sanitizeTitle` also strips leaked fence tokens (`[Journal Entry]` etc.).
- **Forged-goal-ID filtering** — `goalUpdates` are kept only when `goalId` ∈ the user's active-goal set; `/api/journal` re-checks ownership before writing.
- **Cost/latency** — the `generateContent` config sets `thinkingConfig: { thinkingBudget: 0 }` (thinking is billed at the output rate and adds ~5s on schema-constrained extraction), `maxOutputTokens: 2048`, and `temperature: 0` (deterministic). `/api/analyze` injects at most 25 pending task titles + 20 active goals. Warm `/api/analyze` ≈ 1s. Pricing (Jul 2026): 2.5 Flash $0.30/$2.50 per 1M in/out; Flash-Lite is ~3–6× cheaper if a future A/B shows it holds extraction quality.

### Schedule / calendar
`components/ScheduleScreen.tsx` (`/schedule`) — month calendar with task/reminder dots, a day panel, and an "upcoming" feed. Tasks and reminders are **editable inline** via the bottom-sheet modal (title/date/time/priority/notes); the task↔reminder type is locked when editing (separate tables). Uses the `PATCH` routes, which accept `description` edits.

### Unauthenticated try-mode
`lib/demoData.ts` seeds `localStorage` (key: `progress-demo-state-v1`) with fake entries/tasks/reminders/goals. `JournalScreen`, `TasksScreen`, `ScheduleScreen`, and `RemindersScreen` read from localStorage when no session exists. Saving prompts "Sign in to save". Journal analysis can *create* demo goals but cannot auto-advance them (see above).

### Rate limiting
`middleware.ts` uses an in-memory sliding window: 5 req/min on `/api/transcribe`, 20/min on `/api/analyze`, 60/min default. Rate limiting runs before auth checks.

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
| `components/GoalsSection.tsx` | Self-contained goals UI — unit-aware progress bars, ± steppers, inline edit, demo + optimistic |
| `components/ScheduleScreen.tsx` | Calendar + day panel + upcoming feed; inline-editable tasks/reminders |
| `app/api/transcribe/route.ts` | Groq Whisper (public) — MIME allowlist, 25 MB cap |
| `lib/gemini.ts` | Gemini client — `analyzeWithGemini()`; extracts tasks/reminders/goals/goalUpdates; prompt-injection defense, forged-goal-ID filtering, safety settings, fallback-safe |
| `app/api/analyze/route.ts` | Gemini analysis with regex fallback; injects pending tasks + active goals + timezone for auth'd users |
| `app/api/journal/route.ts` | Upserts entry; creates tasks/reminders/goals; applies ownership-checked goal increments |
| `app/api/goals/route.ts`, `app/api/goals/[id]/route.ts` | Goals CRUD — auth-gated, IDOR-checked, keeps `completed` in sync + clamps `current ≤ target` |
| `middleware.ts` | Rate limiting + CSP/HSTS/security headers |
| `prisma/schema.prisma` | User, JournalEntry, Task, Reminder, **Goal** + NextAuth models |
| `types/index.ts` | All shared TS types (incl. `Goal`, `ExtractedGoal`, `GoalUpdate`, `GoalPeriod`) |

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
- `Task.source`: `"journal"` | `"manual"`. `Reminder.reminded` reserved for future push notifications
- `Goal`: `unit` (free-form counting noun, default `"times"`), `target` (int ≥1), `current` (int, 0…target), `period` (`"week"` | `"month"` | `"ongoing"`), `completed` (mirrors `current ≥ target`), `source` (`"journal"` | `"manual"`). No relation to `JournalEntry` — goals persist independent of the entry that created them.
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
- Editing a schedule item **cannot switch task↔reminder** (different tables) — the type toggle is locked in edit mode.
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