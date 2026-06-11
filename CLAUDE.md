# Murmur (ConvoJournal) — Claude Code Instructions

## Project

Mobile-first voice journaling PWA called **Murmur**. Users speak a daily brain-dump; the app transcribes it, parses Yesterday/Today/Tomorrow sections, extracts tasks + reminders, and saves everything to SQLite. Auth-gated for saving; unauthenticated try-mode for voice/transcription.

## Stack

- **Next.js 14** App Router · TypeScript strict · Tailwind CSS
- **Prisma 5 + SQLite** (local dev), target Neon Postgres for production
- **NextAuth v4** (`lib/auth.ts`) — Google OAuth (env-gated) + dev credentials provider
- **OpenAI Whisper** for voice transcription — `app/api/transcribe/route.ts` (public, rate-limited)
- **Local regex parser** — `lib/parser.ts` (zero AI cost; Gemini Flash 2.5 swap is next priority)
- **Custom autocomplete** — Trie + bigram N-gram in `lib/autocomplete.ts`, persists to localStorage

## Key Files

| File | Role |
|------|------|
| `components/JournalScreen.tsx` | 5-phase state machine (idle → writing → recording → analyzing → review) |
| `components/ScheduleScreen.tsx` | Calendar + day panel + upcoming feed |
| `components/TasksScreen.tsx` | Task CRUD with auth gate |
| `components/RemindersScreen.tsx` | Reminder CRUD with auth gate |
| `app/api/analyze/route.ts` | Calls `lib/parser.ts` — replace with Gemini here |
| `app/api/transcribe/route.ts` | Whisper transcription (no auth required) |
| `lib/auth.ts` | NextAuth config + `requireAuth()` guard used in every data API route |
| `lib/validators.ts` | Zod schemas for all API inputs |
| `lib/parser.ts` | Regex Yesterday/Today/Tomorrow + task/reminder extraction |
| `lib/autocomplete.ts` | Suggestion engine |
| `middleware.ts` | Rate limiting (5/min transcribe, 20/min analyze, 60/min default) + security headers |
| `prisma/schema.prisma` | User, JournalEntry, Task, Reminder + NextAuth models |
| `types/index.ts` | All shared TS types |

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # prisma generate + next build
npm run db:push      # apply schema to SQLite (no migration file)
npm run db:migrate   # create a named migration
npm run db:studio    # Prisma Studio GUI
```

## Environment

Copy `.env.example` → `.env` and fill in:

```
DATABASE_URL=file:./dev.db
OPENAI_API_KEY=sk-...           # required for Whisper
NEXTAUTH_SECRET=...             # required; generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=               # leave blank to disable Google OAuth
GOOGLE_CLIENT_SECRET=           # leave blank to disable Google OAuth
```

Google OAuth activates automatically when both vars are non-empty. No code changes needed.

## Auth Architecture

- `requireAuth()` in `lib/auth.ts` — returns `{ userId }` or `NextResponse 401`; used at the top of every data route
- All DB queries are scoped to `session.user.id` — multi-user isolation enforced at the query layer
- `/api/transcribe` and `/api/analyze` are intentionally public (try-mode)
- UI auth gates: `TasksScreen` + `RemindersScreen` show an overlay when unauthenticated; `JournalScreen` shows "Sign in to save" instead of the Save button
- Dev login available at `/login` when `NODE_ENV === "development"` (any email, no password)

## Code Conventions

- All screen/component files are `"use client"` — Next.js App Router
- Tailwind utility classes + component classes in `globals.css` (`.btn-primary`, `.card`, `.input`, etc.)
- Custom colors: `ink-*` (charcoal bg), `parchment-*` (cream text), `gold` (accent), `priority-*` (task colors)
- Mobile-first layout, max-width 430px, safe-area padding via CSS `env()`
- No class components — functional + hooks only

## Data Model Notes

- One `JournalEntry` per calendar day — upserted on `{ userId, date }` composite key
- `Task.source`: `"journal"` (auto-extracted) | `"manual"` (user-added)
- `Reminder.reminded` reserved for future push notification logic
- All models have `userId` FK with `onDelete: Cascade`

## Current Priorities

1. **Gemini Flash 2.5 swap** — replace `lib/parser.ts` call in `/api/analyze` with structured Gemini prompt returning `ParsedEntry` JSON. Install `@google/generative-ai`, add `GOOGLE_API_KEY`.
2. **Journal history page** at `/journal` — browse past entries by date
3. **Google OAuth credentials** — user will provide; just add to `.env`
4. **Production deploy** — swap SQLite → Neon Postgres, deploy to Vercel

## Gotchas

- `RemindersScreen` not linked in `BottomNav` — accessible at `/reminders` only
- `JournalScreen.tsx` is 640+ lines — avoid adding top-level state; split phases into subcomponents if it grows
- Autocomplete lives in localStorage only; resets on browser data clear
- Parser deduplicates task vs reminder edge cases, but items with both a task keyword and a date may still appear in both lists
- `NEXTAUTH_SECRET` must be set or NextAuth will throw on any session operation
