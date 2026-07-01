# Progress (ConvoJournal) — Handoff Doc

Last updated: 2026-06-30. **Read "🎨 Dashboard Redesign" below first — it's the active in-progress work.** The older "⚠️ Last Session" (reminders security fix) is still valid history below it.

---

## 🎨 Dashboard Redesign + Goals Progress — IN PROGRESS (this session)

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

## ⚠️ Last Session — read this first

1. **Security fix not yet deployed.** `app/api/reminders/[id]/route.ts` had a critical bug — PATCH/DELETE had zero auth or ownership check (anyone who got a reminder's ID could modify/delete it, even unauthenticated). It's fixed locally (matches the secure pattern in `tasks/[id]/route.ts` now) but **not committed or pushed yet**. This is a live bug in production right now — prioritize shipping it. Uncommitted files:
   ```
   M .gitignore   M CLAUDE.md   M app/api/reminders/[id]/route.ts
   M lib/gemini.ts   M lib/validators.ts   M package.json / package-lock.json
   ?? scripts/   (new: scripts/test-gemini.ts)
   ```
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
| Demo mode | `lib/demoData.ts` — localStorage-backed fake data for unauthenticated users |
| Date utils | date-fns, chrono-node |

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
| Rate limiting | In-memory sliding window: 5/min transcribe, 5/min analyze (both AI/billable), 60/min default, + 200/hr global AI cap across all IPs |
| HTTP headers | CSP, X-Frame-Options, HSTS, nosniff, Referrer-Policy, Permissions-Policy |
| Secrets | `.env`, `.vercel/`, `*.db` gitignored; never committed (verified via full git history search); no `NEXT_PUBLIC_` leakage |
| Prompt injection | `[STRICT SECURITY RULE]` delimiter in Gemini system prompt + `sanitizeField()` strips suspicious output |
| Try-mode | `/api/transcribe` + `/api/analyze` public; saving requires auth |

Full security audit run 2026-06-30 — only finding was the reminders IDOR (now fixed locally). No hardcoded secrets, no raw SQL, no `dangerouslySetInnerHTML`, errors don't leak internals to clients.

---

## Data Models

**User** — created on first sign-in via NextAuth adapter; `onboarded: Boolean` gates `/onboarding` redirect
**JournalEntry** — one per user per day (upsert on `userId + date`)
- `rawContent`, `yesterday`, `today`, `tomorrow`, `mood`
- Relations: `tasks[]`, `reminders[]`

**Task**
- `title`, `description`, `dueDate`, `priority` (high/medium/low), `completed`
- `source`: `"journal"` (auto-extracted) | `"manual"` (user-added)

**Reminder**
- `title`, `description`, `eventDate`, `reminded` (reserved for future push)

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
| `/api/reminders/[id]` | PATCH/DELETE | Yes | Update / remove reminder (ownership-checked — fix pending deploy) |
| `/api/user/onboard` | POST | Yes | Mark onboarding complete |

---

## Screens

### Today (`/`)
Home dashboard. Greeting based on time of day, today's agenda (tasks due today/overdue + reminders sorted by time), quick links to Calendar and Goals, CTA to write tonight's reflection.

### Journal (`/journal`)
5-phase state machine: Idle (entry history) → Writing (textarea + autocomplete) → Recording (waveform) → Analyzing (Gemini call, transcript reveal) → Review (parsed sections, mood badge, tasks/reminders, Save).

Unauthenticated users see demo entries seeded from `lib/demoData.ts`.

### Tasks (`/tasks`), Schedule (`/schedule`), Reminders (`/reminders`, not in nav), Settings (`/settings`), Onboarding (`/onboarding`)
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
