# ConvoJournal — Project TLDR

## What's Been Built

### Stack
- **Next.js 14** (App Router) · TypeScript · Tailwind CSS
- **Prisma 5 + SQLite** for local data storage
- **OpenAI Whisper** (`whisper-1`) for voice-to-text transcription (server-side)
- **OpenAI GPT-4o-mini** for journal analysis ← *to be swapped for Gemini Flash 2.5*

### Features Done
- **Voice recording** — tap mic, speak, transcription appears (works on iOS Safari + Android Chrome)
- **Journal entry flow** — Record → Analyze → Review → Save
- **AI parsing** — extracts Yesterday / Today / Tomorrow sections + mood from free-form speech
- **Task extraction** — pulls action items with priority (high/medium/low) and due dates
- **Reminder extraction** — pulls future events with dates
- **Tasks screen** — list view with complete/delete, manual add, filter by pending/completed/all
- **Reminders screen** — upcoming vs past, manual add, highlights today/tomorrow
- **Mobile-first UI** — bottom nav, touch-friendly, PWA manifest included
- **Secrets secured** — `.env` gitignored, `.env.example` provided

### API Routes
| Route | Purpose |
|-------|---------|
| `POST /api/transcribe` | Audio → Whisper → text |
| `POST /api/analyze` | Text → GPT → structured JSON |
| `POST /api/journal` | Save entry + create tasks/reminders |
| `GET  /api/journal` | Fetch past entries |
| `GET/POST /api/tasks` | List + create tasks |
| `PATCH/DELETE /api/tasks/[id]` | Toggle complete, delete |
| `GET/POST /api/reminders` | List + create reminders |

---

## What's Left To Do

### Next Session
- [ ] **Swap GPT-4o-mini → Gemini Flash 2.5** for journal analysis (`/api/analyze`)
  - Install `@google/generative-ai` SDK
  - Add `GOOGLE_API_KEY` to `.env.example`
  - Update `app/api/analyze/route.ts`

### Near-Term
- [ ] **Journal history page** (`/journal`) — view past entries by date, browse Yesterday/Today/Tomorrow
- [ ] **Edit journal entries** — tap to revise a saved entry
- [ ] **Past entries search** — keyword search across saved journal content
- [ ] **Reminder notifications** — browser web push API for day-of alerts

### Polish / Later
- [ ] **PWA icons** — add actual `icon-192.png` and `icon-512.png` to `/public`
- [ ] **Offline support** — service worker to cache the app shell
- [ ] **Cloud deploy** — swap SQLite → Postgres (Neon), deploy to Vercel
- [ ] **Auth** — lock the app behind a PIN or OAuth so only you can access it
- [ ] **Daily summary** — end-of-day recap email/notification of tasks due

---

## Setup (for any new machine)
```bash
cp .env.example .env       # fill in OPENAI_API_KEY (+ GOOGLE_API_KEY soon)
npm install
npm run db:push            # creates local SQLite DB
npm run dev                # http://localhost:3000
```
