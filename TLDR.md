# Progress (ConvoJournal) — Handoff Doc

## What It Is

A mobile-first voice journaling PWA called **Progress**. Speak a daily brain-dump → it transcribes, parses Yesterday / Today / Tomorrow sections, extracts tasks + reminders, and saves everything to SQLite. Unauthenticated users can try voice/transcription freely and see demo data; saving requires a sign-in.

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + custom theme (ink / parchment / gold) |
| Database | Prisma 5 + SQLite (dev) → Neon Postgres (prod) |
| Auth | NextAuth v4 — Google OAuth (env-gated) + dev credentials |
| Voice | **Groq Whisper** (`whisper-large-v3-turbo`) via `groq-sdk` — server-side only |
| Parsing | Local regex + chrono-node (`lib/parser.ts`) — zero AI cost |
| Autocomplete | Custom Trie + bigram N-gram (`lib/autocomplete.ts`) |
| Demo mode | `lib/demoData.ts` — localStorage-backed fake data for unauthenticated users |
| Date utils | date-fns, chrono-node |

> `lib/openai.ts` is dead code left over from the OpenAI Whisper era — nothing imports it.

---

## File Structure

```
app/
  api/
    auth/[...nextauth]/route.ts  → NextAuth handler
    transcribe/route.ts          → Groq Whisper transcription (public, GROQ_API_KEY)
    analyze/route.ts             → Calls lib/parser.ts (auth not required)
    journal/route.ts             → CRUD for JournalEntry (auth required)
    tasks/route.ts               → GET + POST tasks (auth required)
    tasks/[id]/route.ts          → PATCH + DELETE tasks (auth + ownership check)
    reminders/route.ts           → GET + POST reminders (auth required)
    reminders/[id]/route.ts      → PATCH + DELETE reminders (auth + ownership check)
  login/page.tsx                 → Sign-in page (Google OAuth + dev credentials)
  landing/page.tsx               → Marketing / landing page
  layout.tsx                     → Root layout, PWA meta, fonts, AuthProvider, SideNav
  page.tsx                       → Mounts TodayScreen + BottomNav (home dashboard)
  journal/page.tsx               → Mounts JournalScreen + BottomNav
  tasks/page.tsx                 → Mounts TasksScreen
  reminders/page.tsx             → Mounts RemindersScreen (not linked in nav)
  schedule/page.tsx              → Mounts ScheduleScreen
  globals.css                    → Tailwind base + component classes
  manifest.json                  → PWA manifest
components/
  TodayScreen.tsx                → Home dashboard — greeting, agenda, quick links
  JournalScreen.tsx              → 5-phase entry flow + entry history list (idle phase)
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
  validators.ts                  → Zod schemas for all API inputs
  parser.ts                      → Regex section splitter + task/reminder extractor
  autocomplete.ts                → Trie + NGram suggestion engine
  demoData.ts                    → Demo state seed + localStorage persistence
  openai.ts                      → DEAD CODE — unused since Groq migration
  prisma.ts                      → Prisma singleton
  wordlist.ts                    → Static word seed for autocomplete
middleware.ts                    → Rate limiting + security headers
types/
  index.ts                       → All shared TS interfaces
  next-auth.d.ts                 → Extends Session with user.id
prisma/
  schema.prisma                  → User, JournalEntry, Task, Reminder + NextAuth models
```

---

## Security (implemented)

| Layer | What was done |
|-------|---------------|
| Auth | NextAuth v4, all data routes require session; userId scoped on every query |
| IDOR | `ownedTask()` / `ownedReminder()` check before PATCH/DELETE → 404 not 403 |
| File uploads | 25 MB cap (Content-Length + blob.size), strict MIME allowlist → 413/415 |
| Input validation | Zod on every POST/PATCH — enums, length caps, datetime format |
| Rate limiting | In-memory sliding window: 5/min transcribe, 20/min analyze, 60/min default |
| HTTP headers | CSP, X-Frame-Options, HSTS, nosniff, Referrer-Policy, Permissions-Policy |
| Secrets | `.env` and `*.db` gitignored; `.env.example` provided |
| Try-mode | `/api/transcribe` + `/api/analyze` public; saving requires auth |

---

## Data Models

**User** — created on first sign-in via NextAuth adapter  
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
| `/api/analyze` | POST | No | Text → local parser → ParsedEntry JSON |
| `/api/journal` | GET | Yes | Fetch last N entries (max 100) |
| `/api/journal` | POST | Yes | Upsert entry by date, create tasks/reminders |
| `/api/tasks` | GET | Yes | All tasks for user |
| `/api/tasks` | POST | Yes | Create manual task |
| `/api/tasks/[id]` | PATCH | Yes | Toggle completed / update fields |
| `/api/tasks/[id]` | DELETE | Yes | Remove task |
| `/api/reminders` | GET | Yes | All reminders for user |
| `/api/reminders` | POST | Yes | Create manual reminder |
| `/api/reminders/[id]` | PATCH | Yes | Update reminder |
| `/api/reminders/[id]` | DELETE | Yes | Remove reminder |

---

## Screens

### Today (`/`)
Home dashboard. Greeting based on time of day, today's agenda (tasks due today/overdue + reminders sorted by time), quick links to Calendar and Goals, CTA to write tonight's reflection.

### Journal (`/journal`)
5-phase state machine:
1. **Idle** — entry history list (or empty state with mic button + "write it out")
2. **Writing** — textarea with inline autocomplete suggestions
3. **Recording** — animated waveform, elapsed timer
4. **Analyzing** — character-by-character transcript reveal while Groq processes
5. **Review** — parsed sections, mood badge, tasks/reminders, Save (or "Sign in to save" if unauthenticated)

Unauthenticated users see demo entries in the history list (seeded from `lib/demoData.ts`).

### Tasks (`/tasks`)
Auth gate if unauthenticated. Filter pills (All / Pending / Completed), add form, task rows with priority dot + due date + "from journal" badge.

### Schedule (`/schedule`)
Calendar widget (month nav, dots on days with items), day panel (tasks + reminders for selected day), upcoming feed grouped by date.

### Reminders (`/reminders`) — not in nav
Auth gate if unauthenticated. Past/upcoming split, proximity labels (Today / Tomorrow / In Nd), date+time add form.

---

## Setup

```bash
cp .env.example .env       # fill in GROQ_API_KEY + NEXTAUTH_SECRET
npm install
npm run db:push            # creates dev.db
npm run dev                # http://localhost:3000
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

Google OAuth: add `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` to `.env` — activates automatically, no code changes needed.

---

## What's Done

- [x] Voice recording (iOS Safari + Android Chrome compatible)
- [x] Groq Whisper transcription (server-side, `whisper-large-v3-turbo`, no client-side key exposure)
- [x] Journal entry parsing — Yesterday / Today / Tomorrow + mood
- [x] Task extraction with priority + due dates
- [x] Reminder extraction with dates
- [x] Journal history — entry list in idle phase, tap to view parsed sections
- [x] Today dashboard — greeting, agenda, quick links
- [x] Desktop layout — SideNav sidebar
- [x] Tasks screen — complete / delete / filter / manual add
- [x] Reminders screen — past/upcoming split, manual add
- [x] Schedule / calendar screen — month view + day panel + upcoming feed
- [x] Inline autocomplete with Trie + N-gram model
- [x] Demo mode for unauthenticated users (demoData.ts → localStorage)
- [x] Mobile-first UI, bottom nav, touch targets ≥ 44px
- [x] Desktop sidebar nav
- [x] PWA manifest (add to home screen)
- [x] NextAuth v4 — Google OAuth stub + dev credentials
- [x] Per-user data isolation (userId FK on all models)
- [x] Zod input validation on all POST/PATCH routes
- [x] File upload hardening (25 MB cap, MIME allowlist)
- [x] Rate limiting middleware
- [x] HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
- [x] Unauthenticated try-mode (voice works without sign-in)
- [x] Secrets secured (.env + *.db gitignored)

---

## What's Next (Priority Order)

### High Priority
- [ ] **Gemini Flash 2.5 swap** — replace `lib/parser.ts` in `/api/analyze` with structured Gemini prompt
  - Install `@google/generative-ai`
  - Add `GOOGLE_API_KEY` to `.env.example`
  - Update `app/api/analyze/route.ts`
  - Expected gain: better mood detection, semantic section splitting, richer task context
- [ ] **Google OAuth credentials** — user provides `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`; just add to `.env`
- [ ] **Production deploy** — swap SQLite → Neon Postgres, deploy to Vercel

### Near-Term
- [ ] **Dead code cleanup** — delete `lib/openai.ts` (unused since Groq migration)
- [ ] **PWA icons** — real `icon-192.png` / `icon-512.png` in `/public` (currently 404)
- [ ] **Edit journal entries** — tap to revise a saved entry
- [ ] **Reminder notifications** — Web Push API + service worker

### Polish / Later
- [ ] **Offline support** — service worker to cache app shell
- [ ] **Search** — keyword search across past journal content
- [ ] **Reminders nav link** — add `/reminders` to BottomNav / SideNav
- [ ] **Daily summary** — end-of-day push/email recap of tasks due

---

## Known Quirks

- Reminders screen not linked in BottomNav or SideNav — go to `/reminders` directly
- Autocomplete resets if localStorage is cleared
- Parser may list an item in both tasks and reminders if it has both a task keyword and a future date (deduplication handles most cases)
- `NEXTAUTH_SECRET` must be set — NextAuth throws on any session operation without it
- Demo state localStorage key is `"progress-demo-state-v1"` (legacy name; app was previously called "Progress")
- `lib/openai.ts` still exists and throws on import if `OPENAI_API_KEY` is missing — but nothing imports it, so it's harmless until cleaned up
- `JournalScreen.tsx` is 640+ lines — functional but would benefit from splitting phases into subcomponents if logic grows
