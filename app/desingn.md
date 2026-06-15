# Progress — UI/UX Specification

> A voice-first journaling companion. You speak or write a daily brain-dump; Progress
> parses it into structured reflection (Yesterday / Today / Tomorrow), extracts tasks
> and reminders, and threads them through a calendar and a task list.
>
> This document specifies the interactive prototype in **`Progress App.dc.html`** and how
> each screen should look and behave, on **mobile** and **desktop**. It is written to
> match the real `ConvoJournal` codebase (Next.js + Prisma), so engineering and design
> stay in sync.

---

## 1. Product in one paragraph

Progress turns an unstructured daily reflection into structure with zero manual data
entry. The hero interaction is the **journal**: a five-phase machine (idle → writing/
recording → analyzing → review → saved). On-device autocomplete assists typing; a
rule-based parser splits the entry into time-sections and pulls out **tasks** (priority +
due date) and **reminders** (date + time). Those extracted items flow automatically into
the **Today** agenda, the **Calendar**, and the **Goals/Tasks** list. The aesthetic is
quiet, literary, and nocturnal — designed to feel like writing in a leather journal by
lamplight rather than filling in a form.

---

## 2. Design system (tokens)

These are the exact tokens from `tailwind.config.js` / `globals.css`. Use them verbatim.

### Color

| Role | Token | Hex |
|---|---|---|
| App background | `ink-950` | `#0f0e0b` |
| Card surface | `ink-900` | `#1a1815` |
| Raised surface / inputs | `ink-800` | `#252220` |
| Hairline borders | `ink-700` | `#302d29` |
| Border (hover) | `ink-600` | `#3d3a35` |
| Primary text | `parchment-100/200` | `#f0e4cc` / `#e8d5b0` |
| Body text | `parchment-300` | `#d4c09a` |
| Muted text | `parchment-600` | `#8a7a68` |
| Faint / meta | `parchment-700/800` | `#6a5a4a` / `#4a3c2e` |
| **Accent (gold)** | `gold` | `#c8a878` |
| Gold light / dark | — | `#d8bc98` / `#a88858` |
| Priority · high | `priority-high` | `#c87a6a` |
| Priority · medium | `priority-medium` | `#c8a860` |
| Priority · low | `priority-low` | `#7a9a7a` |
| Section · Yesterday | blue | label `rgba(96,165,250,.7)` on `rgba(23,37,84,.3)` |
| Section · Today | amber | label `rgba(251,191,36,.7)` on `rgba(69,26,3,.3)` |
| Section · Tomorrow | green | label `rgba(74,222,128,.7)` on `rgba(5,46,22,.3)` |

The palette is deliberately tiny: a near-black brown ramp, one warm parchment ramp for
text, and a single gold accent. Color is information — gold = interactive/now, the three
section tints = time, the three priority dots = urgency. Never introduce a new hue
without a semantic reason.

### Type

- **Display** — `Playfair Display`, usually *italic*. Greetings, screen titles, entry
  snippets, empty-state lines, the timer. This is the "voice" of the product.
- **Mono** — `DM Mono`. Everything else: body, labels, metadata, buttons, dates. This is
  the "interface."
- **Label** convention: `10px`, `uppercase`, `letter-spacing 0.2em`, `parchment-600`.
  Used above every section ("YOUR DAY, IN ORDER", "UPCOMING", "TASKS (2)").
- Minimum interactive target: **44px**. Minimum body size: **13px**.

### Shape, depth, motion

- Radii: cards `16px` (`rounded-2xl`), tight cards / inputs / buttons `12px`, pills `20px+`.
- Borders do the work of separation; shadows are reserved for the device frame and
  modals. One subtle glow token exists for the record button (`gold-glow`).
- Motion is short and calm: `fade-in` (translateY 6–7px, 0.4s), `slide-up` (16–20px,
  0.35s) for entering panels and sheets, `blink` for the typing caret, `wave` for the
  recording bars, `pulse-ring` for the idle record halo, `spin` for the analyzing
  spinner. Easing is `ease-out`. Nothing bounces; nothing is decorative-only.

---

## 3. Information architecture

Four primary destinations, addressable by the bottom nav (mobile) and side nav (desktop):

| Tab | Route | Nav glyph | Purpose |
|---|---|---|---|
| **Today** | `/` | ● circle | The at-a-glance home: greeting + the day's agenda + a nudge to journal. |
| **Journal** | `/journal` | ▢ rounded-square | The reflection flow + your archive of past entries. |
| **Calendar** | `/schedule` | ▪ square | Month view of tasks/reminders, a day panel, and an upcoming feed. |
| **Goals** | `/tasks` | ◆ diamond | The full task list with filtering and CRUD. |

Nav glyphs are pure geometry (no icon font): filled **gold** when active, a `1.6px`
parchment-800 outline when inactive. This is intentional brand minimalism — the shapes
double as a quiet legend (circle = a day, square = a grid, diamond = a goal).

**Reminders** are not a top-level tab; they surface contextually inside Today's agenda
and inside the Calendar (blue dots, blue `◎` rows). Tasks and reminders are the shared
data spine — created in any of three places (journal extraction, the Goals add-form, the
Calendar add-modal) and reflected everywhere at once.

---

## 4. Responsive frame

The **same screen layer** renders inside one of two chromes — content never forks.

- **Desktop** — a browser-window frame (1080px wide). A fixed **192px left side-nav**
  (wordmark, the four nav rows, a `v1.0` footer) sits beside a content column capped at
  **600px** and centered, so long-form reading stays comfortable on wide displays.
- **Mobile** — a **382px phone** frame with a status bar, the content column at full
  width (20px gutters), and a **sticky bottom nav**. The add-item modal becomes a
  bottom sheet.

The prototype exposes a **Desktop / Mobile toggle** in the top control bar so both form
factors are reviewable from one file. In production these are simply the `md:` breakpoint
(`SideNav` is `hidden md:flex`, `BottomNav` is `md:hidden`).

---

## 5. Screen specs

### 5.1 Today (`/`)

**Goal:** answer "what is today?" in under three seconds, then point at the journal.

- **Header** — kicker date ("SUNDAY, JUNE 14", mono uppercase) above an italic Playfair
  greeting that changes with the clock ("Good morning / afternoon / evening.").
- **"Your day, in order"** — a single ordered list mixing:
  - **Reminders** for today → a gold `h:mm a` timestamp + title.
  - **Tasks** due today or overdue → a priority dot + title; overdue tasks get a small
    `overdue` flag in `priority-high`.
  - Empty state: an italic line, *"A clear day. Start fresh."*
- **Tonight card** — raised `ink-800` panel, gold kicker "TONIGHT", an italic prompt
  ("How did the day actually feel?"), and the primary CTA **Write tonight's reflection**
  → opens the Journal directly in the writing phase.
- **Quick links** — two tappable tiles to Calendar ("Your week →") and Goals ("N pending →").

### 5.2 Journal (`/journal`) — the state machine

The header carries the title "Journal", the date, and (once a flow starts) four **phase
dots** that fill gold as you advance. Phases:

1. **Idle / archive** — list of past entries, newest first. Each row: relative date
   ("SUN, JUN 14"), an optional **mood** pill (gold outline), a two-line italic snippet,
   and a count footer ("2 tasks · 1 reminder"). Two header actions start a new entry:
   a **write** (pencil) button and a **record** (mic, gold) button. *(First-run, with no
   entries, this is instead a centered hero: a pulsing-halo record button + a "write it
   out" link.)*
2. **Writing** — prompt "how are you feeling today?", a **live suggestion strip**, and a
   large auto-focused textarea with a live char count. Suggestions come from an on-device
   engine: a trie completes the current partial word (≥2 chars); after a space, a bigram
   model predicts the next word. Tap a chip to insert it. Footer: **← back** and a gold
   **Analyse entry** (disabled until there's text).
3. **Recording** — a large Playfair count-up timer (`MM:SS`), an animated **waveform**
   (CSS `scaleY` bars, staggered), and a circular **stop** control. *(In the prototype,
   stopping feeds a realistic sample transcript to stand in for live transcription.)*
4. **Analyzing** — a spinner + "PARSING ENTRY…" while the transcript **types itself in**
   character-by-character behind a blinking gold caret. On completion the parser runs and
   advances to review.
5. **Review** — the structured result:
   - a **mood** badge (emoji glyph + word),
   - up to three **section cards** — Yesterday (blue), Today (amber), Tomorrow (green),
   - **Tasks (N)** with priority dots + parsed due dates,
   - **Reminders (N)** with parsed dates,
   - a **show transcript ▾** toggle, and **Discard** / **Save Entry**.
   - If nothing was detected: "No structure detected — saved as raw text."
6. **Saved** — a gold `✦`, "Entry saved", a count summary, and **New entry**. Saving
   commits the entry to the archive **and** pushes its extracted tasks/reminders into the
   shared store (so they appear in Today, Calendar, and Goals immediately).
7. **Entry detail** — tapping an archived entry opens a read view (date, mood, the three
   section cards, tasks, reminders) with a **← back** affordance.

### 5.3 Calendar (`/schedule`)

- **Month widget** — `‹ MONTH YYYY ›` nav, a Monday-start grid (6 weeks). Today's number
  is gold; the selected day gets a gold-tinted cell. Each day shows up to two dots: a gold
  dot if any **task** is due, a blue dot if any **reminder** falls there. A legend sits
  below.
- **Day panel** — the selected day's items (label reads "today" when applicable). Tasks
  show a checkbox + priority dot + title (toggle completes them); reminders show a blue
  `◎` + title + time. Each row has a `✕` delete. A **+ add** opens the modal pre-set to
  that day. Empty: "nothing here — tap + add to schedule something."
- **Upcoming feed** — everything from today forward, grouped by day label, plus an
  "anytime" group for undated open tasks.
- **Add-item modal / sheet** — a **task ⇄ reminder** toggle; title; date (+ time for
  reminders); a priority row (tasks only); optional notes; and a gold **Add task / Add
  reminder** button. On desktop it's a centered sheet within the frame; on mobile it
  slides up from the bottom.

### 5.4 Goals / Tasks (`/tasks`)

- **Header** — "Tasks", an "N pending" count, and a circular **+** that reveals the
  add-form (title, priority select, optional due date).
- **Filter pills** — `ALL · PENDING · COMPLETED` (segmented, gold-on-ink active state).
- **Task rows** — a 20px gold checkbox (tap to complete; completed rows dim and
  strike-through), the title, then a metadata line: priority dot + label, optional due
  date, and an italic "from journal" tag when the task was extracted from a reflection.
  A trash affordance deletes. Empty states are phase-aware ("nothing pending", etc.).

---

## 6. Interaction & state model (prototype)

All data lives in one shared store so the screens stay consistent:

- `tasks[]` — `{ id, title, priority, completed, dueDate, source }`
- `reminders[]` — `{ id, title, eventDate }`
- `entries[]` — `{ id, date, mood, rawContent, yesterday, today, tomorrow, tasks, reminders }`

Key behaviors that are **actually wired** in `Progress App.dc.html`:

- Journal **autocomplete** (trie prefix + bigram next-word) and the **parser**
  (time-section split, task-trigger regexes, time/event reminder detection, priority &
  mood heuristics) run live on whatever you type.
- Saving a journal entry **mutates the shared store** → new tasks/reminders appear in
  Today, Calendar, and Goals without a refresh.
- Task **toggle / delete**, Goals **add**, Calendar **month nav / day select / add**,
  and the **modal** all mutate the same store and re-render every dependent view.
- The **Desktop/Mobile** toggle re-chromes the identical content.

### Production notes (from the codebase)

- The real app persists via REST routes (`/api/journal`, `/api/analyze`, `/api/tasks`,
  `/api/reminders`) backed by Prisma/SQLite; analysis falls back to the local
  rule-based parser when the LLM route is unavailable.
- Tasks/Reminders are **auth-gated** (NextAuth); voice capture works signed-out, but
  saving prompts sign-in. The prototype omits the auth gate for reviewability.
- Autocomplete trains on every saved entry and persists its n-gram model to
  `localStorage` — suggestions get more personal over time.

---

## 7. Voice & copy

Lowercase, unhurried, second-person. Prompts are emotional, not mechanical ("how are you
feeling today?", "How did the day actually feel?"). Labels are terse and uppercase.
Numbers are spelled into context ("N pending", "2 tasks · 1 reminder") rather than shown
as bare badges. Never cheerful-corporate; never an empty "0 items" — say "a clear day."

---

## 8. Accessibility & craft checklist

- 44px minimum hit targets; checkboxes use padded tap zones.
- Gold-on-ink and parchment-on-ink meet contrast for body and interactive text; avoid
  parchment-700/800 for anything users must read quickly.
- Motion is subtle and never blocks input; the entrance animations are transform-only so
  content is always present even if an animation is interrupted.
- One accent, one type pairing, three semantic color sets (time / priority / state).
  Resist additions — the calm is the brand.
