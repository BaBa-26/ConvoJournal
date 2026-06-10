# ConvoJournal — Claude Code Instructions

## Project

Mobile-first voice journaling PWA called **Murmur**. Users speak or type a daily brain-dump; the app parses it into Yesterday/Today/Tomorrow sections, extracts tasks + reminders, and persists everything to a local SQLite DB.

## Stack

- **Next.js 14** App Router · TypeScript strict · Tailwind CSS
- **Prisma 5 + SQLite** (local dev), target Neon Postgres for production
- **OpenAI Whisper** for voice transcription (server-side, `app/api/transcribe/route.ts`)
- **Local regex parser** for journal analysis — `lib/parser.ts` (no AI cost, but Gemini Flash 2.5 swap is the next priority)
- **Custom autocomplete** — Trie + bigram N-gram in `lib/autocomplete.ts`, persists to localStorage

## Key Files

| File | Role |
|------|------|
| `components/JournalScreen.tsx` | Main screen, 5-phase state machine |
| `components/ScheduleScreen.tsx` | Calendar + day panel + upcoming feed |
| `components/TasksScreen.tsx` | Task list with filter/add/CRUD |
| `app/api/analyze/route.ts` | Calls `lib/parser.ts` — replace with Gemini here |
| `app/api/transcribe/route.ts` | Whisper transcription |
| `lib/parser.ts` | Regex-based Yesterday/Today/Tomorrow + task/reminder extraction |
| `lib/autocomplete.ts` | Suggestion engine |
| `prisma/schema.prisma` | JournalEntry, Task, Reminder models |
| `types/index.ts` | All shared TS types |

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # prisma generate + next build
npm run db:push      # apply schema to SQLite (no migration file)
npm run db:migrate   # create a migration file
npm run db:studio    # Prisma Studio GUI
```

## Environment

Copy `.env.example` → `.env` and fill in:
- `OPENAI_API_KEY` — required for Whisper transcription
- `DATABASE_URL` — defaults to `file:./dev.db`
- `GOOGLE_API_KEY` — add when Gemini swap is implemented

## Code Conventions

- All screen/component files are `"use client"` — Next.js App Router
- Tailwind utility classes + component classes in `globals.css` (`.btn-primary`, `.card`, `.input`, etc.)
- Custom colors: `ink-*` (charcoal bg), `parchment-*` (cream text), `gold-*` (accent), `priority-*` (task colors)
- Mobile-first layout, max-width 430px, safe-area padding via CSS `env()`
- No class components — functional + hooks only
- State enums use union types (`RecordingPhase`, `TaskFilter`) defined in `types/index.ts`

## Data Model Notes

- One `JournalEntry` per calendar day — upserted by date in `POST /api/journal`
- Tasks have `source: "journal" | "manual"` — tracks whether auto-extracted or manually added
- `Reminder.reminded` exists for future push notification logic — not used yet

## Current Priorities

1. **Gemini Flash 2.5 swap** — replace `lib/parser.ts` call in `/api/analyze` with a structured Gemini prompt that returns `ParsedEntry` JSON. Install `@google/generative-ai`, add `GOOGLE_API_KEY`.
2. **Journal history page** at `/journal` — browse past entries by date
3. **Reminder notifications** — Web Push API + service worker

## Gotchas

- `RemindersScreen` is not linked in `BottomNav` — accessible at `/reminders` only
- `JournalScreen.tsx` is 640+ lines; avoid adding more top-level state — split phases into subcomponents if needed
- Autocomplete model lives in localStorage only; survives page reloads but not browser data clears
- Parser deduplicates tasks vs reminders but edge cases exist when an item has both a task keyword and a date
