# ConvoJournal (Murmur) — Handoff Doc

## What It Is

A mobile-first voice journaling PWA. You speak (or type) a daily brain-dump, and the app parses it into Yesterday / Today / Tomorrow sections, extracts tasks + reminders, and saves everything to a local SQLite DB. Branded "Murmur" in the PWA manifest.

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + custom theme (ink/parchment/gold) |
| Database | SQLite via Prisma 5 |
| Voice | OpenAI Whisper API (`whisper-1`) — server-side only |
| Parsing | Local regex + chrono-node (`lib/parser.ts`) — **no AI cost** | foudn this replacement so i have no ai cost  might iterate gemini flash 2.5 later on 
| Autocomplete | Custom Trie + bigram N-gram model (`lib/autocomplete.ts`) |
| Icons | Lucide React |
| Date utils | date-fns, chrono-node |

**No Google AI / Gemini dependency installed yet.** The openai package is present only for Whisper.

---

## File Structure

```
app/
  api/
    transcribe/route.ts     → Whisper transcription endpoint
    analyze/route.ts        → Calls lib/parser.ts (local, no AI)
    journal/route.ts        → CRUD for JournalEntry
    tasks/route.ts          → GET + POST tasks
    tasks/[id]/route.ts     → PATCH (complete toggle) + DELETE
    reminders/route.ts      → GET + POST reminders (missing dedicated file — inline in route)
    reminders/[id]/route.ts → PATCH + DELETE reminders
  layout.tsx                → Root layout, PWA meta, fonts
  page.tsx                  → Mounts JournalScreen
  tasks/page.tsx            → Mounts TasksScreen
  reminders/page.tsx        → Mounts RemindersScreen (not linked in nav)
  schedule/page.tsx         → Mounts ScheduleScreen
  globals.css               → Tailwind base + component classes
  manifest.json             → PWA manifest (name: "Murmur")
components/
  JournalScreen.tsx         → 5-phase entry flow (idle/writing/recording/analyzing/review)
  TasksScreen.tsx           → Task list with filter/add/complete/delete
  RemindersScreen.tsx       → Past + upcoming reminders
  ScheduleScreen.tsx        → Calendar widget + day panel + upcoming feed
  BottomNav.tsx             → Fixed nav (Journal + Schedule tabs only)
  Waveform.tsx              → Animated recording waveform bars
hooks/
  useRecorder.ts            → MediaRecorder + Whisper fetch hook
lib/
  parser.ts                 → Regex-based Yesterday/Today/Tomorrow splitter + task/reminder extractor
  autocomplete.ts           → Trie + NGram suggestion engine (persists to localStorage)
  openai.ts                 → OpenAI client singleton (Whisper only)
  prisma.ts                 → Prisma singleton
  wordlist.ts               → Static word seed for autocomplete
types/
  index.ts                  → All shared TS interfaces
prisma/
  schema.prisma             → JournalEntry, Task, Reminder models
```

---

## Data Models

**JournalEntry** — one per day (upsert by date)
- `rawContent`, `yesterday`, `today`, `tomorrow`, `mood`
- Relations: `tasks[]`, `reminders[]`

**Task**
- `title`, `description`, `dueDate`, `priority` (high/medium/low), `completed`
- `source`: "journal" (auto-extracted) | "manual" (user-added)
- `journalEntryId` (nullable FK)

**Reminder**
- `title`, `description`, `eventDate`, `reminded` (for future push notifications)
- `journalEntryId` (nullable FK)

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/transcribe` | POST | Audio blob → Whisper → `{ text }` |
| `/api/analyze` | POST | Text → local parser → ParsedEntry JSON |
| `/api/journal` | GET | Fetch last 30 entries |
| `/api/journal` | POST | Upsert entry by date, create tasks/reminders |
| `/api/tasks` | GET | All tasks (sorted: incomplete first, by due date) |
| `/api/tasks` | POST | Create manual task |
| `/api/tasks/[id]` | PATCH | Toggle completed / update fields |
| `/api/tasks/[id]` | DELETE | Remove task |
| `/api/reminders` | GET | All reminders (sorted by eventDate) |
| `/api/reminders` | POST | Create manual reminder |
| `/api/reminders/[id]` | PATCH | Update reminder |
| `/api/reminders/[id]` | DELETE | Remove reminder |

---

## Screens

### Journal (`/`)
5-phase state machine in `JournalScreen.tsx`:
1. **Idle** — mic button + "write it out" link
2. **Writing** — textarea with inline autocomplete suggestions
3. **Recording** — animated waveform, elapsed timer, stop button
4. **Analyzing** — typing-reveal animation of transcript
5. **Review** — parsed sections, mood badge, extracted tasks/reminders, save/discard

### Tasks (`/tasks`)
Filter pills (All / Pending / Completed), add form, task rows with priority + due date badges, source badge ("from journal").

### Schedule (`/schedule`)
- **Calendar widget** — month nav, dots on days with tasks/reminders
- **Day panel** — tasks + reminders for selected day, quick-add button
- **Upcoming feed** — forward-looking list grouped by date

### Reminders (`/reminders`) — not linked in nav
Past/upcoming split, proximity labels (Today / Tomorrow / In 5d), add form with date+time picker.

---

## Autocomplete Engine

`lib/autocomplete.ts` — runs entirely in the browser:
- **Trie** for prefix matching + frequency weighting
- **Bigram N-gram model** for context-aware next-word suggestions
- **Levenshtein spell correction** for typo tolerance
- **localStorage persistence** — learns from every saved entry via `.train(text)`
- Returns up to 3 inline suggestions while typing in the writing phase

---

## Journal Parser

`lib/parser.ts` — local, zero-cost, regex-based:
- **Section splitting**: keyword detection (yesterday/last night/this morning/tonight/tomorrow) to bucket sentences
- **Task extraction**: TASK_TRIGGERS array ("need to", "gotta", "have to", "todo:", "remember to") + chrono-node for due dates + priority keywords (urgent/asap → high, whenever/eventually → low)
- **Reminder extraction**: EVENT_TRIGGERS + chrono-node date parsing, deduplicates against tasks
- **Mood detection**: keyword lists per mood (happy, sad, stressed, excited, tired, anxious)

---

## Env + Setup

```bash
cp .env.example .env       # fill in OPENAI_API_KEY
npm install
npm run db:push            # creates dev.db
npm run dev                # http://localhost:3000
```

`.env.example` variables:
```
OPENAI_API_KEY=sk-...
DATABASE_URL=file:./dev.db
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## What's Done

- [x] Voice recording (iOS Safari + Android Chrome compatible)
- [x] Whisper transcription (server-side, no client-side API key exposure)
- [x] Journal entry parsing — Yesterday / Today / Tomorrow / mood
- [x] Task extraction with priority + due dates
- [x] Reminder extraction with dates
- [x] Tasks screen — complete/delete/filter/manual add
- [x] Reminders screen — past/upcoming split, manual add
- [x] Schedule/calendar screen — month view + day panel + upcoming feed
- [x] Inline autocomplete with N-gram model
- [x] Mobile-first UI, bottom nav, touch-friendly
- [x] PWA manifest (add to home screen)
- [x] Prisma + SQLite, one entry per day upsert
- [x] Secrets secured (.env gitignored)

---

## What's Next (Priority Order)

### High Priority
- [ ] **Journal history page** (`/journal`) — browse past entries by date, view parsed sections
- [ ] **Swap local parser → Gemini Flash 2.5** for `/api/analyze`-not now that i have a local parser that works decently, might iterate on it and only add gemini flash for mood detection or something specific instead of the whole parsing task
  - Install `@google/generative-ai`- not needed now that i have a local parser that works decently, might iterate on it and only add gemini flash for mood detection or something specific instead of the whole parsing task
  - Add `GOOGLE_API_KEY` to `.env.example`-same with this 
  - Update `app/api/analyze/route.ts` with structured prompt + JSON schema output
  - Expected gain: better mood detection, semantic section splitting, richer task context
  -Actually deplying - setting upo data base - (supa bas/any free data base - and learn how to hos ton vercel or somthing - might be a bit of work but would be good to have cloud deploy and not rely on local sqlite for a journaling app)

### Near-Term
- [ ] **Edit journal entries** — tap to revise a saved entry
- [ ] **Reminder notifications** — Web Push API, service worker registration
- [ ] **Search** — keyword search across past journal content

### Polish / Later
- [ ] **PWA icons** — real `icon-192.png` / `icon-512.png` in `/public`
- [ ] **Offline support** — service worker to cache app shell
- [ ] **Cloud deploy** — swap SQLite → Neon Postgres, deploy to Vercel
- [ ] **Auth** — PIN lock or OAuth
- [ ] **Daily summary** — end-of-day email/push recap of tasks due
- [ ] **Reminders nav link** — add `/reminders` to BottomNav

---

## Known Quirks

- **Reminders screen** not linked in BottomNav — accessible at `/reminders` only
- **Autocomplete** resets if localStorage is cleared
- **Parser may duplicate** an item as both a task and reminder if it has both a task keyword and a date — mitigated by dedup set in `extractReminders`
- **Timezone boundary edge case** — dates normalized with `setHours(0,0,0,0)` in local time
- **JournalScreen.tsx is 640+ lines** — functional but would benefit from splitting into phase subcomponents if logic grows further
