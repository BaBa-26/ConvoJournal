# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Progress** (repo: ConvoJournal) — mobile-first voice journaling PWA. Users speak a daily brain-dump; the app transcribes it, parses Yesterday/Today/Tomorrow sections, extracts tasks + reminders, and saves to Postgres. Auth-gated for saving; unauthenticated try-mode shows demo data from localStorage.

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # prisma generate + next build
npm run db:push      # push schema changes to DB without a migration file
npm run db:migrate   # create a named migration (use for schema changes)
npm run db:studio    # Prisma Studio GUI
```

## Stack

- **Next.js 14** App Router · TypeScript strict · Tailwind CSS
- **Prisma 5 + Neon Postgres** (prod) — `DATABASE_URL` (pooled) + `DIRECT_URL` (migrations)
- **NextAuth v4** — Google OAuth + dev credentials provider (dev-only)
- **Groq** `whisper-large-v3-turbo` via `groq-sdk` for transcription — `GROQ_API_KEY` required
- **Gemini 1.5 Flash** via `@google/generative-ai` for journal analysis — `GEMINI_API_KEY` required; falls back to `lib/parser.ts` regex on error
- Custom Trie + bigram N-gram autocomplete (`lib/autocomplete.ts`) persisted to localStorage

## Architecture

### Auth flow
`lib/auth.ts` — `authOptions` wires NextAuth with PrismaAdapter. `requireAuth()` is called at the top of every data API route and returns `{ userId }` or a `NextResponse 401`. All DB queries are scoped to `userId`.

- Google OAuth is active when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set — no code changes needed.
- Dev credentials provider is only included when `NODE_ENV === "development"`.
- After first Google sign-in, users are redirected to `/onboarding` (checked via `User.onboarded`). Subsequent logins go to `/`.
- Session strategy is `"database"`. `user.id` is injected into the session via the `session` callback.

### Data flow — journal entry
`JournalScreen` (5-phase state machine) → `POST /api/transcribe` (Groq Whisper, no auth) → `POST /api/analyze` (Gemini 1.5 Flash, no auth required but injects pending-task context if session exists) → `POST /api/journal` (auth required, upserts by `userId + date`). Tasks and reminders are created in the same `POST /api/journal` call.

### Unauthenticated try-mode
`lib/demoData.ts` seeds `localStorage` (key: `progress-demo-state-v1`) with fake entries/tasks/reminders. `JournalScreen`, `TasksScreen`, and `RemindersScreen` read from localStorage when no session exists. Saving prompts "Sign in to save".

### Rate limiting
`middleware.ts` uses an in-memory sliding window: 5 req/min on `/api/transcribe`, 20/min on `/api/analyze`, 60/min default. Rate limiting runs before auth checks.

## Key Files

| File | Role |
|------|------|
| `lib/auth.ts` | NextAuth config + `requireAuth()` guard |
| `lib/validators.ts` | Zod schemas for all API inputs |
| `lib/parser.ts` | Regex Yesterday/Today/Tomorrow + task/reminder extraction |
| `lib/demoData.ts` | Demo state — `createDemoState`, `loadDemoState`, `appendDemoJournalEntry` |
| `components/JournalScreen.tsx` | 5-phase state machine + entry history (640+ lines — avoid adding top-level state) |
| `components/TodayScreen.tsx` | Home dashboard — greeting, agenda, quick links |
| `app/api/transcribe/route.ts` | Groq Whisper (public) — MIME allowlist, 25 MB cap |
| `lib/gemini.ts` | Gemini 1.5 Flash client — `analyzeWithGemini()`, prompt injection defense, safety settings, fallback-safe |
| `app/api/analyze/route.ts` | Gemini analysis with regex fallback; injects pending tasks + timezone as context for auth'd users |
| `middleware.ts` | Rate limiting + CSP/HSTS/security headers |
| `prisma/schema.prisma` | User, JournalEntry, Task, Reminder + NextAuth models |
| `types/index.ts` | All shared TS types |

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
- All app models have `userId` FK with `onDelete: Cascade`

## Gotchas

- `RemindersScreen` is not linked in `BottomNav` or `SideNav` — only reachable at `/reminders`
- `GEMINI_API_KEY` must be set in Vercel env vars — if missing, Gemini throws and the route silently falls back to `lib/parser.ts` (logged via `console.error`)
- `JournalScreen.tsx` phase transition: `runAnalysis` `useCallback` must be declared **before** the `useEffect` that references it in its deps array (TypeScript forward-reference error otherwise)
- `phase === "analyzing"` (not `"recording"`) is the correct check in the post-transcription effect — phase is already `"analyzing"` by the time `recState` reaches `"idle"`
- `NEXTAUTH_SECRET` must be set or NextAuth throws on any session operation
- Demo state localStorage key is `"progress-demo-state-v1"` (legacy name)
