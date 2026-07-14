# Progress Design System — "Lamplight"

The reusable design system for Progress across web (React + Tailwind) and the coming
native build. It **deepens the existing identity** — quiet, warm near-black, literary,
unhurried — and formalizes the customization architecture that already exists
(user accents, light/dark, wallpapers, type scale). It supersedes the token tables in
`app/desingn.md`; the voice/IA sections of that document still stand.

Everything here is implemented as: CSS custom properties (`app/globals.css`) →
Tailwind theme tokens (`tailwind.config.js`) → component classes (`@layer components`)
→ React primitives (`components/ui/`). Screens consume tokens and primitives only;
raw hex values in screen code are a defect.

---

## 0. Principles

1. **Calm is a feature.** Fewer surfaces, hairline borders, one accent. Empty space is
   composed, not left over.
2. **Two voices.** *Voice* (Playfair Display, usually italic) speaks — greetings,
   prompts, empty states, entry prose, big numerals, the timer. *Interface* (DM Mono)
   labels — buttons, metadata, dates, counts. When the app talks to you like a person,
   it's Voice. When it organizes information, it's Interface.
3. **Color is information.** Accent = interactive / "now". Time tints = when. Priority
   dots = urgency. Never decorate with a new hue.
4. **Users own the mood.** Accent, color mode, wallpaper, surface style, and type scale
   are user preferences. Semantic tokens exist so every component obeys all five
   automatically. A component that hardcodes gold, dark ink, or a px font-size for
   Voice text is broken.
5. **Motion is breath, not bounce.** Transform+opacity only, ease-out, short. Loops
   breathe slowly. Everything honors `prefers-reduced-motion`.
6. **Nothing hides under anything.** Sticky/floating chrome always carries a scrim.
   Content must never be readable *through* a control.

---

## 1. Color tokens

All color is expressed as CSS variables holding **RGB channels** (alpha-modifier safe),
themed by `[data-color-mode]`, and consumed via Tailwind (`bg-ink-900`, `text-accent/70`).

### 1.1 Surfaces — `ink` (flips in light mode)

| Token | Role | Dark | Light |
|---|---|---|---|
| `ink-950` | page shell | `#0f0e0b` | `#f4eede` |
| `ink-900` | cards | `#1a1815` | `#fbf7ee` |
| `ink-800` | raised / inputs | `#252220` | `#efe8d8` |
| `ink-700` | hairline borders | `#302d29` | `#e2d8c4` |
| `ink-600` | strong borders | `#3d3a35` | `#d0c4ac` |

### 1.2 Text — `parchment` (flips in light mode)

`parchment-100…300` primary→body, `400…500` secondary, `600` muted labels,
`700…800` faint meta. Floor for *must-read* text is `parchment-600`; `700/800` are for
glanceable meta only (spec rule carried over from `desingn.md`).

### 1.3 Accent (user preference; defaults gold)

`accent`, `accent-light`, `accent-dark` — set by `PreferencesProvider` from the five
presets (gold `#c8a878`, clay `#c87a6a`, sage `#7a9a7a`, dusk `#6f9bd1`, mauve
`#b07ab0`). `onaccent` is fixed near-ink text for accent-filled controls (never flips —
contrast is preserved on every preset in both modes). `gold` remains as **fixed brand
chrome** (logo, favicon, marketing) and must not be used for in-app interactive color.
Interactive = `accent`, always.

### 1.4 Time tints (new — replaces the cool blue/amber/green section colors)

Warm-family hues for Yesterday / Today / Tomorrow that stay inside the lamplight world:

| Token | Meaning | Hue (dark & light share channels) | Label variant |
|---|---|---|---|
| `tint-past` | yesterday / behind you | plum-ash `165 131 160` | `tint-past-label` (dark `#c9a2c2`-ish / light `#7d5878`) |
| `tint-now` | today / in your hands | ember `207 128 84` | `tint-now-label` (dark `#e0a678` / light `#9d5a30`) |
| `tint-next` | tomorrow / ahead | moss `122 154 122` | `tint-next-label` (dark `#a4c2a4` / light `#4e7050`) |

Usage recipe (the `SectionCard` primitive encodes it): background `tint-*/10`
(light mode `/14`), border `tint-*/30`, label `tint-*-label`, body text stays
`parchment-300`. Tints never color body text and never appear on controls.

### 1.5 Priority + risk

`priority-high #c87a6a · priority-medium #c8a860 · priority-low #7a9a7a` — dots and
small flags only. `priority-high` doubles as the destructive/danger hue (`.btn-danger`,
error banners) so no new red enters the palette.

### 1.6 Fixed pairings

`onaccent` (`#0f0e0b`) on any `accent` fill. Scrims: `--scrim` = ink-950 channels used
in gradients under floating chrome.

---

## 2. Typography

Families: `font-display` (Playfair Display + Georgia fallback) · `font-mono` (DM Mono +
ui-monospace). Nothing else, ever.

### 2.1 Roles (Tailwind `fontSize` tokens)

Voice sizes multiply by `--type-scale` (user preference: sm .92 / md 1 / lg 1.12), so
the entire spoken layer honors the setting — not just the greeting.

| Token | Size | Use |
|---|---|---|
| `text-label` | 10px / 0.2em tracking / uppercase | section labels ("YOUR DAY, IN ORDER") — pair with `.label` |
| `text-meta` | 11px / 1.5 | timestamps, counts, hints |
| `text-body` | 13px / 1.6 | default interface body (mono floor) |
| `text-body-lg` | 15px / 1.7 | transcripts, journal prose, inputs |
| `text-voice-sm` | 17px×ts / 1.5 | inline prompts, card questions |
| `text-voice` | 22px×ts / 1.35 | screen titles, sheet titles, saved-state heading |
| `text-voice-lg` | 28px×ts / 1.25 | the greeting, hero lines |
| `text-voice-xl` | 44px×ts / 1.1 | the recording timer, landing hero |
| `text-numeral` | 34px×ts / 1.1 | stat-tile figures |

Rules:
- Voice roles are always `font-display`; prompts and empty-state lines are *italic*.
- Interface roles are always `font-mono`.
- Screen titles: `text-voice font-display italic text-parchment-200`, sentence case
  ("Journal", "Schedule", "Goals") — one convention, every screen.
- Numerals in Voice (timer, stats) use Playfair; tabular alignment via `tabular-nums`
  where digits change live.

### 2.2 Minimums

Body ≥ 13px. Meta ≥ 10px and only `parchment-600+` when it must be read. Line length
≤ ~34rem (the content column handles this).

---

## 3. Space, shape, elevation

- **Spacing** is the 4px grid. Named rhythm: screen gutter `px-5` (20), card padding
  `p-4` (16), tight card `p-3` (12), stack gap between cards `gap-3` (12), between
  sections `gap-6` (24). Safe areas via `.pt-safe/.pb-safe/.pb-nav`.
- **Radii**: inputs/buttons/tight cards `rounded-xl` (12) · cards `rounded-2xl` (16) ·
  pills `rounded-full` · sheets `rounded-t-3xl` (24, top corners).
- **Elevation**: borders separate; shadows are reserved for (a) the record button's
  accent glow (`shadow-glow`, `shadow-glow-lg` — accent-aware, follows the user's
  accent), (b) overlays (`shadow-sheet` for bottom sheets, `shadow-modal` for centered
  dialogs). Nothing else casts.
- **Scrims**: `.action-bar` and the floating nav sit on a gradient scrim
  (`ink-950 → transparent`); with a wallpaper active they switch to translucent blur.
  Content never shows through controls (Principle 6).

---

## 4. Motion

Tokens (CSS vars + Tailwind `transitionDuration` / `animation`):

| Token | Value | Use |
|---|---|---|
| `--dur-quick` / `duration-quick` | 120ms | presses, toggles, hovers |
| `--dur-gentle` / `duration-gentle` | 240ms | reveals, chips, small layout shifts |
| `--dur-calm` / `duration-calm` | 400ms | screen/panel entrances |
| `--dur-payoff` | 700ms | the review-reveal choreography |
| `--ease-calm` | cubic-bezier(0.22, 1, 0.36, 1) | everything |

Named animations:
- `animate-fade-in` (6px rise + fade, calm) — screen entrances.
- `animate-slide-up` (16px, calm) — sheets, review panel.
- `animate-rise` (12px rise + fade, payoff timing) — **staggered** on review items:
  each structured card enters `80ms` after the previous (`style={{animationDelay}}`),
  so the parsed day *assembles* deliberately regardless of API latency.
- `animate-breathe` — the idle record halo: scale 1→1.05, opacity .45→.12, **3.6s**
  loop (replaces `pulse-ring`'s 2s notification-style ping).
- `animate-wave-1…8` — recording bars (now driven by real input level, see §6.6).
- `animate-blink` — the typing caret.
- Presses: `active:scale-[0.98]` at `duration-quick`. Nothing bounces; nothing loops
  except breath, waveform, and spinners.

**Reduced motion** (global, in `globals.css`): under `prefers-reduced-motion: reduce`
all entrance animations collapse to opacity-only ~1ms, breathing/wave loops stop
(waveform falls back to a static level glyph), and the payoff stagger renders complete
immediately. No component may opt out.

---

## 5. Accessibility contract

- **Focus**: global `:focus-visible` ring — 2px `accent` at 70%, offset 2. Components
  never suppress it (`focus:outline-none` without a visible replacement is a defect).
- **Touch targets**: ≥ 44×44px for every interactive element. Small glyphs (✎, ✕, ▸)
  sit inside 44px padded zones (`.icon-btn`, `.icon-btn-sm` visual sizes differ; hit
  area doesn't).
- **Contrast**: primary/body text (parchment-100…400 on ink-950/900) ≥ 7:1 dark,
  ≥ 8:1 light. Muted (parchment-600) ≥ 4.5:1. `onaccent` on every accent preset ≥ 8:1
  both modes. Meta (parchment-700/800) is decorative-only.
- **Screen readers**: recorder phases announce via `aria-live="polite"` status text;
  the timer is `role="timer"`; toggles are real `role="switch"`/`aria-pressed`
  buttons; the record button's label changes with state ("Start recording", "Stop
  recording — 0:42 elapsed").
- **Wallpapers**: user images get a readability scrim + text-shadow on on-wallpaper
  text (already in place); cards carry the contrast guarantee.

---

## 6. Components

Notation: every component lists **states**. Implementation: CSS component classes in
`globals.css` for stateless styling; React primitives in `components/ui/` where
behavior lives. States marked ⌨ have distinct focus-visible treatment automatically.

### 6.1 Buttons

| Class / primitive | Anatomy | States |
|---|---|---|
| `.btn-primary` | accent fill, `onaccent` mono text, rounded-xl, min-h 44 | default · hover (accent-light) · active (scale .98) · ⌨ · disabled (40%) · loading (`aria-busy` + inline spinner, label persists) |
| `.btn-ghost` | ink-800 fill, ink-600 border, parchment-400 text | same set; hover = ink-700 fill, parchment-200 text |
| `.btn-quiet` | no fill/border, parchment-500 text, min-h 44 | hover parchment-300 · active .98 · ⌨ — for "← back", "show transcript", tertiary acts |
| `.btn-danger` | priority-high/10 fill, /40 border, priority-high text | for Discard-with-content, delete confirms |
| `.icon-btn` | 44×44 rounded-xl, ink-800 + ink-700 border, glyph 15–18px | default · hover (border ink-600, text up a step) · active .95 · ⌨ · `.icon-btn-accent` variant (accent/10 fill, accent/30 border) |

Never two `.btn-primary` on one screen region; the primary act is singular.

### 6.2 Inputs & fields

`.input` / `.textarea` (ink-800, ink-600 border, body-lg text, placeholder
parchment-700): default · focus (accent/60 border + accent/30 ring) · ⌨ · error
(`.input-error`: priority-high/50 border + /20 ring) · disabled (40%).
Field scaffolding: `.label` above, `.field-hint` (meta, parchment-700) or
`.field-error` (meta, priority-high) below. Selects/date/time inputs share `.input`.

### 6.3 Cards

- `.card` (ink-900, ink-700 border, rounded-2xl, p-4) — static container.
- `.card-tight` (rounded-xl, p-3) — dense lists, widgets.
- `.card-interactive` — adds hover border-ink-600 + active scale .99 + cursor; for
  tappable cards (entry rows, quick links). ⌨ applies.
- Translucent wallpaper variant is automatic (`data-surface="translucent"`).

### 6.4 SectionCard (time-tinted) — `components/ui/SectionCard.tsx`

Props: `tint: "past" | "now" | "next"`, `label`, `children`, optional `editable`.
Recipe per §1.4. States: static · editable (body becomes a seamless textarea, border
raises to `tint/50`, a quiet "edited" meta appears) · entering (`animate-rise` with
stagger index). Used in review, entry detail, and (read-only) entry cards.

### 6.5 ActionBar — `.action-bar`

Sticky footer for phase actions. Carries the scrim (§3); on wallpaper, blur.
Children: at most one `.btn-primary`, plus ghost/quiet siblings. Sits above the mobile
nav (`bottom-[4.75rem]`), flush bottom on desktop. Content scrolling beneath is
masked, always.

### 6.6 Record button & Waveform — `components/ui/RecordButton.tsx`, `Waveform.tsx`

The product's signature control.
- **Sizes**: hero 96px (journal idle), compact 56px (future inline contexts).
- **Idle**: ink-800 disc, 2px accent/50 ring, accent mic glyph, `animate-breathe` halo
  (accent/20). Hover: ring accent, `shadow-glow`. ⌨.
- **Recording**: disc becomes accent/15 with accent ring; glyph swaps to a rounded
  stop square (parchment-100); halo stops breathing and instead tracks live input
  level (scale 1 + level×0.15) — the app visibly *listens*. Timer (`text-voice-xl`
  Playfair, `tabular-nums`) sits above; helper meta "tap to stop" below.
- **Processing**: disabled, glyph dims, thin accent arc spins (`spin-slow`).
- **Denied / unavailable**: disc keeps shape, glyph slashed-mic in parchment-600, and
  the screen shows the recovery state (§7.2) — the button itself never errors silently.
- **Waveform**: driven by `AnalyserNode` RMS level (real signal, web) — bars scale from
  actual audio; reduced-motion or no-signal renders a static 8-dot level row. *Native:*
  swap the level source for `AVAudioRecorder.averagePower` / `AudioRecord` peaks; the
  component contract is just `level: 0…1`.

### 6.7 List rows (task / reminder / timeline)

`components/ui/ListRow.tsx` variants:
- **Task row**: 24px round checkbox (44px hit) · title (body, parchment-200) · meta
  line (priority dot + label, due date, "from journal" italic tag). States: default ·
  completed (checkbox fills accent, title parchment-600 strike) · overdue (meta gains
  priority-high "overdue" flag) · editing (row raises to ink-800).
- **Reminder row**: `◎` glyph in `tint-past-label`… no — reminders keep their
  identity: accent time (`h:mm a`, mono) + title; past-due dims.
- **Timeline/day item** (schedule day panel & upcoming feed): time gutter (mono meta,
  right-aligned, fixed 64px) · dot/checkbox · content. Trailing `.icon-btn-sm` edit ✎
  and delete ✕ (44px hits). Empty gutters keep alignment.
- Swipe affordances are **not** used on web (hover reveals trailing actions on
  desktop; always-visible at reduced opacity on touch). *Native:* replace trailing
  buttons with standard swipe actions.

### 6.8 Chips & pills

- **Mood pill**: accent/10 fill, accent/25 border, rounded-full — mood word in
  *Voice* (`font-display italic text-[13px]`), optional glyph. The mood is the entry
  speaking, not a data tag.
- **Suggestion chip** (autocomplete): ink-800, ink-600 border, mono meta text;
  press inserts (active .95). Strip scrolls horizontally, no wrap.
- **Count badge**: accent/15 fill, accent text, rounded-full, min 20px.
- **Filter segment / SegmentedControl**: ink-900 track (rounded-xl), active segment
  ink-800 raised with accent text + accent/30 border; inactive parchment-600. 44px
  tall. Used for GOALS|TASKS, plain|parse capture mode, LIGHT|DARK (in Settings).

### 6.9 Sheets & modals — `components/ui/Sheet.tsx`

Mobile: bottom sheet (`rounded-t-3xl`, ink-900, `shadow-sheet`, drag-handle bar,
slide-up calm). Desktop ≥ md: centered dialog (rounded-2xl, `shadow-modal`, fade+rise).
Scrim: ink-950/60 + blur(2px). States: entering · settled · dismissing (reverse,
gentle). Esc + scrim-tap + handle-swipe dismiss; focus is trapped; `aria-modal`.
*Native:* becomes the system sheet; keep content ≤ 90vh and self-scrolling.

### 6.10 EmptyState — `components/ui/EmptyState.tsx`

`✦` (accent/50, text-voice size) or nothing · one *Voice italic* line
(parchment-500) · optional second meta line · optional `.btn-quiet` action.
Copy stays in the product's lowercase, unhurried voice ("a clear day. start fresh.").
Never a bare "0 items".

### 6.11 Attachments — `components/ui/AttachmentTile.tsx`, `AttachButton`

- **AttachButton**: an `.icon-btn` (paperclip/camera glyph) available in capture
  (writing footer) and review. On web opens file input (`accept="image/*"` +
  documents); *native:* the same button opens the camera/library sheet — the
  component takes an `onPick(files)` and doesn't know the source.
- **AttachmentTile** (64px, rounded-lg, ink-800): states —
  `uploading` (thumb at 40% + thin accent progress ring + cancel ✕),
  `failed` (priority-high/40 border, retry glyph center, meta "tap to retry"),
  `done` (thumb full, quiet remove ✕ on hover/touch-reveal),
  `file` (non-image: extension label in mono + filename meta).
- **Inline strip**: horizontal row of tiles under the composer/review (wraps to grid
  ≥ 4). **In entry detail**: images render as a soft-cornered gallery row (max-h 280,
  object-cover, tap → full-screen viewer). **On timeline cards**: up to 3 thumbnail
  dots (20px) after the meta counts ("2 tasks · 1 reminder · ▣▣").
- Upload contract (server, later): `POST /api/attachments` multipart →
  `{ id, url, thumbUrl, mime, size }`; entry JSON stores attachment ids. Local mode
  stores data-URLs in the vault with the same shape.

### 6.12 Navigation

- **BottomNav** (mobile): floating pill, four geometry glyphs + 10px labels. Active =
  accent fill glyph + raised ink-800 circle; inactive parchment-600 outline. The pill
  sits on the §3 scrim so content scrolls beneath legibly. Tab names: **Today,
  Journal, Calendar, Goals** (naming fixed app-wide: no "To-Do's").
- **SideNav** (desktop): 192px; wordmark (BrandMark + Playfair "Progress"), nav rows
  (glyph + mono label; active row ink-800 + accent glyph), profile card, settings row,
  `v1.0` meta.
- Screens with their own chrome (`/landing`, `/login`, `/onboarding`) stay chrome-free.

### 6.13 Banners & toasts

- **Error banner**: priority-high/10 fill, /30 border, body text in priority-high,
  optional retry `.btn-quiet` inline. Slides down gentle; persists until resolved.
- **Quiet toast** (confirmations that don't deserve a screen): ink-800 pill, meta text,
  bottom-center above nav, auto-dismiss 2.4s, opacity-only under reduced motion.

### 6.14 Crisis support card

Unchanged in content (static resources, zero-retention) but adopts system tokens and
**always renders above the ActionBar scrim with `gap-3` clearance** — it can never be
overlapped by controls (this was a live mobile bug). Tint: ink-800 with accent/40
left rule; no red — the card is a hand on the shoulder, not an alarm.

---

## 7. Canonical states (flows own these, components serve them)

### 7.1 Loading
Skeletons are quiet: ink-800 blocks at 60% opacity, `animate-pulse` slowed to 2.4s.
Text placeholders use `▁▁▁` rhythm, never spinners inside cards. Full-screen loads
get the ✦ mark breathing.

### 7.2 Mic denied / unavailable (voice-first first-run reality)
The journal idle screen swaps the halo for a designed state: slashed-mic glyph,
Voice line *"we can't hear you yet."*, meta explaining how to allow the mic
(platform-aware copy), a `.btn-primary` **"write it out instead"** — writing is the
graceful fallback, never a dead end. *Native:* the meta deep-links to app settings.

### 7.3 Transcription / analysis failure
Return the user to their words, never to a void: transcript (if any) is preserved in
the writing surface with an error banner ("couldn't make sense of that — your words
are safe here") + actions **try again** / **save as plain entry**. The eternal-spinner
state is eliminated: `analyzing` has a 20s watchdog that falls back to this state.

### 7.4 The payoff (review)
The structured day assembles with the §4 stagger: mood pill, then sections, then
tasks/reminders/goals, then actions — ~700ms total, independent of API latency (if the
API was slower, it plays on arrival; if faster, it still takes its beat). Every
extracted item is editable in place (§6.4 editable SectionCard; task/reminder rows get
inline edit + remove before save). The transcript stays one quiet toggle away.

### 7.5 Saved
✦ breathes once, "Entry saved" in Voice, counts in meta — then **bridges**: quiet
links to where the items went ("see today's agenda →", "view entry →"). New entry
stays one tap.

---

## 8. Light/dark & customization behavior

- Color mode: `[data-color-mode]` flips ink/parchment; components never branch on
  mode — tokens carry it. The LIGHT/DARK segmented control lives in Settings →
  Appearance (and is removed from the Today header; the capability stays, the chrome
  quiets).
- Accent: all interactive color uses `accent*`; the record glow, focus ring, active
  nav glyph, progress fills all follow the user's preset automatically.
- Wallpaper: `data-has-bg` + `data-surface` behaviors as today; ActionBar/nav scrims
  switch to blur variants; on-wallpaper headers keep the text-shadow guarantee.
- Type scale: all `voice-*`/`numeral` tokens multiply by `--type-scale`; interface
  sizes stay fixed (mono legibility floor).

## 9. Native migration notes (summary)

Sheets → system sheets · waveform level source swaps (contract: `level: 0…1`) ·
trailing row actions → swipe actions · attach button → camera/library system sheet ·
mic-denied deep-links to Settings · hover states are always redundant · safe-area
paddings already env()-based · the ✦/geometry glyph set replaces icon fonts 1:1 as
SF Symbols-style template images.
