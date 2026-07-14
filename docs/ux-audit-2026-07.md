# Progress — App & UX Audit (July 2026)

Method: ran the app locally (dev server, local Postgres, dev-credentials login), drove
every screen in headless Chromium at 390×844 (mobile, primary) and 1440×900 (desktop) —
including a real record → transcribe → parse → review → save loop (transcription mocked;
`/api/analyze` ran the real server path) and the typed-entry path. 35 screenshots captured
across guest, signed-in mobile, and desktop passes.

Verdict in one line: **the identity is real and worth deepening — but the implementation
drifts from its own spec (`app/desingn.md`), the payoff moment under-delivers on trust,
and several states (failure, overlap, empty) work against the calm.**

---

## 1. What already works (protect these)

- **The identity system.** Playfair italic as the product's "voice," DM Mono as the
  "interface," near-black ink + parchment + one gold accent. Where it's applied —
  "Good morning, Aarrav.", the Playfair count-up timer, the ✦ saved mark, entry-card
  snippets in italic serif, Playfair numerals in stat tiles — the app feels genuinely
  distinctive and calm. No redesign should touch this DNA.
- **The customization architecture.** CSS-var driven tokens (`--ink-*`, `--parchment-*`,
  `--accent*`), a full light-mode flip (`[data-color-mode="light"]`), user accents
  (gold/clay/sage/dusk/mauve), wallpapers + translucent surfaces, type scale. This is a
  solid semantic-token foundation; the design system should formalize it, not replace it.
- **Today's dashboard bones.** Greeting + agenda sub-line, Tonight card, stat tiles,
  streak heatmap, recent-reflections widget. Strongest screen in the app.
- **The recording screen's center.** Timer in Playfair + quiet "tap to stop" is the right
  instinct.
- **Voice & copy** are consistently good: "a quiet evening to write", "no goals yet — add
  one, or say 'gym every day this week' in a journal entry".

## 2. Systemic issues (the design-system targets)

### 2.1 The spec's own type hierarchy isn't applied where it matters most
`desingn.md`: *Display (Playfair, usually italic) = greetings, prompts, empty-state
lines — the voice of the product.* But on the journal screen — the heart — the emotional
prompt "how are you feeling today?" is set in **mono**, as are all three stacked
uppercase helper lines (TAP TO SPEAK / OR / WRITE IT OUT). The one place the product
should sound most human currently reads most mechanical. Same for the Goals empty state.

### 2.2 Content bleeds through the floating chrome
The sticky action bar (`.action-bar`) is transparent and the bottom nav floats — so
mid-scroll, card text visibly runs beneath and between the Discard/Save buttons, and the
"0 chars" counter renders *through* the Analyse button. On the review screen the nav pill
sits over the Tomorrow card's text. This reads as broken, not calm. (The known
crisis-card/action-bar overlap bug is the same root cause — z-index + transparent sticky
footers with no scrim/mask.)

### 2.3 Failure states strand the user
Mic permission failure: the phase machine advances optimistically, so the user lands on
an eternal "PARSING ENTRY…" spinner over an empty Entry card, with an error banner
stacked above it. There is no retry affordance, no way back except knowing to tap nav.
Transcription failure similarly dead-ends (error + silent return to idle). For a
voice-first app, mic-denied is a *first-run likelihood*, not an edge case — it needs a
designed state.

### 2.4 The payoff moment claims structure it doesn't let you correct
The review screen renders parser output read-only:
- Mis-sectioned content can't be moved or edited ("pick up the dry cleaning before six",
  said about today, showed under TOMORROW / UPCOMING).
- A garbled reminder title ("Dentist and after that I want to actually start on the tax
  documents, that's hig" — truncated mid-word) can't be edited or deleted before it
  pollutes Today, Calendar and To-Do's — which it then did, twice.
- There is no "keep it as I said it" option — analysis is mandatory (see §5 plain entries).
The moment that should build the most trust ("we heard you correctly") is the moment the
user is least in control.

### 2.5 Saved state is a dead end
✦ "Entry saved · 3 tasks · 1 reminder" is lovely but terminates the ritual with only
"New entry." The extracted items just went *somewhere* — the payoff should bridge to
them ("see today's agenda →"), closing the loop the marketing promises.

### 2.6 Customization chrome leaks into primary surfaces
Today opens with LIGHT/DARK pills + EDIT LAYOUT above the greeting — settings-grade
controls as the first thing seen every morning. Keep the capability; quiet the chrome
(move mode into Settings/Appearance, tuck layout editing behind the profile or a
long-press, reveal-on-intent).

### 2.7 Cool section tints fight the warm identity
Yesterday/Today/Tomorrow cards use saturated navy/amber/green washes. The navy panel is
the only cold surface in the app and visually dominates the review. Time-as-color is
right; the hues should be re-tuned to warm-family equivalents that stay distinct.

### 2.8 Desktop is a stretched phone
The content column caps correctly, but the journal hero top-loads into a void, the
past-entries bar strands mid-screen, and the giant gold CTA bars stretch full-width
(shouty). Desktop deserves layout intent (vertical centering, max-width CTAs), not just
a wider gutter.

### 2.9 Small-target and consistency debt
- Edit ✎ / delete ✕ row affordances ≈ 24px — below the 44px minimum the spec itself sets.
- Screen titles disagree: *Journal* (italic caps), *schedule* (lowercase, roman),
  *To-Do's* (apostrophe'd utility label; nav says TO-DO'S, spec says Goals). One
  convention needed.
- Phase dots crowd the profile button; header rhythm varies per screen.
- Focus visibility: `focus:outline-none` everywhere with no `:focus-visible` replacement —
  keyboard users get nothing.

## 3. Flow-level findings (record → parse → payoff)

1. **Idle**: mic is properly front-and-center; but three stacked mono-caps lines + OR
   divider add ceremony where one quiet display-italic prompt would do. The "View past
   entries · 1" bar is generic — a one-line italic teaser of the latest entry would make
   history feel like a journal, not a database.
2. **Recording**: fake 8-bar waveform reads as an icon, not listening. No pause. No
   guidance about what happens next. The screen has room to reassure ("take your minute —
   we'll sort it after").
3. **Analyzing**: with the regex fallback it flashes by; with Gemini it's 1–2s of spinner +
   self-typing transcript. The choreography shouldn't depend on API latency — it should be
   a deliberate, short, interruptible beat.
4. **Review**: see §2.4. Also: mood pill is mono (voice moment → should be display);
   section cards read as three separate loud panels rather than one structured document.
5. **Saved**: see §2.5.

## 4. Data bugs surfaced by driving the app

- **Same-day re-save duplicates every extracted item.** `POST /api/journal` upserts the
  entry but unconditionally `createMany`s tasks/reminders/goals — my two runs produced
  "6 tasks · 2 reminders" from one day and identical 9:00 AM agenda rows. Any user who
  journals twice in a day hits this.
- Parser emits truncated titles (mid-word "that's hig") — no post-extraction cleanup.
- Tasks with due dates surface in agenda feeds with arbitrary-looking times (6:00 AM /
  12:00 PM defaults presented as if chosen).

## 5. Capability gaps the redesign must design in (from the brief)

- **Plain, un-analyzed entries**: today analysis is mandatory on both input paths. The
  capture surface needs a first-class "just journal" choice, and the timeline needs to
  present plain and parsed entries as equals.
- **Attachments**: no affordance exists anywhere. Needs: attach at capture/review, upload
  states (progress / failed / done), inline display in entry + timeline teaser, camera
  vs. library on native.

## 6. Native-migration flags (design now, port cleanly later)

- Bottom sheet patterns (add-item modal) — native uses system sheets; keep the component
  API sheet-shaped.
- `MediaRecorder` + fake waveform → native `AVAudioEngine`/`AudioRecord` levels; design
  the waveform around a real level signal (works on web via AnalyserNode too).
- Web push / permission prompts differ; the mic-permission failure state must not assume
  a browser prompt (iOS asks once, system-settings after).
- Attachment picker: web `<input type=file>` vs native camera/library sheet — the attach
  affordance should be a single button that maps to either.
- Hover states are decoration only — every interaction must be complete without hover.
- `pb-nav` / safe-area constants already CSS-env based — good for WebView/native shells.

## 7. Redesign priorities (agreed order)

1. Journal record-and-parse experience (incl. plain-entry choice, editable review,
   payoff bridge, failure states).
2. Design-system foundations formalizing the existing token architecture.
3. Today / Schedule / To-Do's (→ proper naming), nav chrome, overlay fixes.
4. Attachments UI (local persistence; server contract specced).
5. Consistency + a11y pass (targets, focus-visible, reduced-motion).
