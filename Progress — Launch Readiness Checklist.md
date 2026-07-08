# Handoff — Storage & Sync + Privacy/Control personalization

**Last updated:** 2026-07-08 · **Branch:** `claude/nifty-hamilton-ISukC`
**Typecheck:** `npx tsc --noEmit` is **clean (exit 0)** as of this handoff.
**Status:** Slices 1–6 done. Slice 7 (verify) pending.

> Paste this into a new chat to continue. Everything below reflects code actually on disk, verified against git + a typecheck pass.

---

## The goal (what this feature is)

Give the user **control and comfort** over where their journal lives — storage as an explicit
personalization choice, not an accident of auth state. Plus a "Privacy & control" cluster of
trust features around it.

- **Default:** signed in → cloud sync (Postgres, cross-device).
- **Toggle:** user can switch to **on-device only even while signed in**.
- **Lossless both ways:** local → account (upload then clear local); account → device (download to vault).
- **Going local keeps the server copy** + a separate explicit "Delete my synced copy" button.
- **Add-ons:** App lock (PIN), Transparency card, Private (device-only) entries. All must stay
  **organized and easy to access** (one "Privacy & control" group in Settings).

Full plan (source of truth): `C:\Users\AARRAV\.claude\plans\refactored-sleeping-emerson.md`

---

## Core architecture (memorize these — the whole refactor hinges on them)

- **Three stores:** ephemeral **demo** (`progress-demo-state-v1`, signed-out try mode, reseeds daily)
  · persistent **vault** (`progress:localVault`, signed-in local mode, **never reseeds**) · **remote** (Postgres).
- **`storageMode`** (`"sync"|"local"`) — per-device choice in localStorage `progress:storageMode`, default `"sync"`.
  **Deliberately NOT synced to the account.**
- **`dataMode`** (`"remote"|"local"`) — derived: `authenticated && storageMode==="sync" ? "remote" : "local"`.
  Read it via `useDataMode()` from `PreferencesProvider`.
- **`activeKind`** (module var in `lib/localStore.ts`) — `authenticated ? "vault" : "demo"`. Set during
  PreferencesProvider **render** (before children's effects) so screens read the right store with no race.
- **Discipline:** auth gates (sign-in prompts) stay `!session`; **data-source branches become `!remote`**.
  Don't collapse the two — a private entry in remote mode is still signed in.

---

## What's DONE ✅

**Slice 1 — core plumbing**
- `lib/localStore.ts` (new) — mode-aware wrapper: `loadLocal/saveLocal/updateLocal/resetLocal`,
  `appendLocalJournalEntry(raw, parsed, isPrivate=false)`, `saveVault/resetVault`,
  `loadPrivateVaultEntries()` (vault entries where `e.private`).
- `lib/demoData.ts` — key-generic core (`loadStateFromKey/saveStateToKey/updateStateAtKey`),
  `VAULT_STORAGE_KEY`, `withAppendedEntry(...isPrivate)`, `demoStateIsEmpty`,
  `demoStateToImportPayload`, `exportToState`.
- `components/PreferencesProvider.tsx` — exposes `storageMode/setStorageMode/dataMode` + `useDataMode()`;
  `setActiveLocalKind(...)` during render; cross-tab storage listener.
- `types/index.ts` — `StorageMode`, `DataMode`, `JournalEntry.private?`.
- **6 screens refactored** off `authed` onto `dataMode`: `today/useTodayData.ts`, `today/widgets.tsx`
  (GoalsTracker), `GoalsSection.tsx`, `TasksScreen.tsx`, `RemindersScreen.tsx`, `ScheduleScreen.tsx`,
  `JournalScreen.tsx` (save/history use `remote`).

**Slice 2 — migration + Settings**
- `app/api/user/import/route.ts` (new) — `POST`, `requireAuth`, `UserImportSchema`, `$transaction`,
  upsert by `{userId_date}`, invalid dates dropped (not 400'd), returns counts.
- `app/api/user/data/route.ts` (new) — `DELETE`, `requireAuth`, deletes rows only (keeps account).
- `lib/syncMigration.ts` (new) — `uploadDemoStoreToAccount`, `uploadVaultToAccount`,
  `downloadAccountToVault`, `demoStoreHasData`, `vaultHasData`.
- `lib/validators.ts` — `UserImportSchema` (lenient dates, caps: entries 366 / tasks·reminders 500 / goals 200).
- `components/SettingsScreen.tsx` — **Storage & sync** section (toggle, confirm modals), server-wipe
  (type-DELETE) modal.

**Slice 3 — transparency**
- SettingsScreen **"Your data, plainly"** card (line ~704) + Export/Delete.

**Slice 6 — organize + discoverability** ✅
- `components/SettingsScreen.tsx` — added a **"Privacy & control"** group heading; the privacy sections
  are now contiguous in order: Storage & sync → App lock → **Private entries** (new info card explaining
  the per-entry "Keep on this device only" toggle) → "Your data, plainly" → Export & delete. Server-copy
  wipe stays inside Storage & sync (local mode). Appearance/Layout/Background/Testing now follow the group.
- `components/ProfileScreen.tsx` — "App settings" bridge copy now reads "Privacy & control, storage &
  sync, app lock, appearance & more" so the privacy cluster is discoverable from the account page.

**Slice 4 — app lock**
- `lib/appLock.ts` (new) — SHA-256 + per-device salt via `crypto.subtle`, `progress:appLock`,
  `MAX_ATTEMPTS = 5`, set/verify/change/clear, session unlock flag.
- `components/AppLockProvider.tsx` (new) — gates children, blur-on-blur overlay, visibility re-lock,
  LockScreen with forgot-gate after 5 wrong (email reset + "remove lock on this device" fallback).
- `app/api/user/app-lock/reset/route.ts` (new) — `POST`, `requireAuth`, **stubbed** (logs intent,
  returns `{ok:true, emailed:false}`, TODO mailer).
- Mounted in `app/layout.tsx` inside `<PreferencesProvider>`.

**Slice 5 — private (device-only) entries** ✅
- Data layer: `types` + `demoData` + `localStore` carry `private`; `useTodayData` remote path folds in
  `loadPrivateVaultEntries()` (`components/today/useTodayData.ts:70-72`).
- `components/JournalScreen.tsx` — `keepPrivate` state + "Keep on this device only" toggle in the review
  UI (**sync/remote mode only**); `handleSave` writes `appendLocalJournalEntry(..., true)` when
  `remote && keepPrivate`; remote history effect merges `remote ∪ loadPrivateVaultEntries()` sorted by
  date desc; "device only" lock badge on private rows (list + detail); `keepPrivate` resets on new entry.
  Private entries' nested tasks/reminders remain read-only in the entry and never hit the server lists.

---

## Settings UX refactor — Claude-style dialog ✅ (2026-07-08)

Settings + Profile are now **one dialog** (like the Claude app) instead of two scrolling pages.
- **Shell:** `components/settings/SettingsDialog.tsx` — desktop = left category rail + right content
  pane; mobile = full-screen category list that **drills into** a panel (back returns to the list).
  Escape/backdrop/✕ close it; a nested-modal-aware Escape guard (`[role=dialog]` count) stops a
  confirm dialog's Escape from also closing settings. Appearance edits keep the staged **save-gate**
  (footer Save/Discard + "Save your changes?" prompt on close when `hasUnsaved`).
- **Provider:** `components/settings/SettingsUIProvider.tsx` — `useSettingsUI().openSettings(cat?)`
  / `closeSettings()`; mounts the single dialog. Wrapped around the app in `app/layout.tsx` (inside
  `AppLockProvider`).
- **Categories/panels** (`components/settings/panels/`): Account, Privacy & control, Appearance,
  Notifications, **Usage (placeholder "coming soon")**, About. Shared controls in
  `components/settings/controls.tsx` (`Toggle`, `Segmented`).
- **Triggers repointed to the dialog:** `SideNav` (account row → `account`; ⚙ Settings → default),
  `ProfileButton` (mobile avatar → `account`), and all three Today layouts' "profile & settings →"
  links. `/settings` + `/profile` routes now render `SettingsRedirect` (opens the dialog over `/`).
- **Deleted:** `components/SettingsScreen.tsx`, `components/ProfileScreen.tsx` (fully superseded by
  panels — content lives once now).
- **Verify done so far:** `npx tsc --noEmit` clean; `npm run dev` compiles, `/ /settings /profile
  /landing /journal /tasks` all serve with no compile/runtime errors. **Still needs a real
  browser click-through** (open dialog, mobile drill-in, appearance save-gate, each confirm modal).

## What's LEFT 🔧 (precise next steps)

### Slice 7 — verify (do NOT deploy until this passes — Aarrav's standing rule)
- `npx tsc --noEmit` (Windows `next build` is broken on `/icon` — expected; ignore).
- `npm run dev` end-to-end:
  1. Signed out → record entry → local; sign in → "bring on-device data in?" → upload → in account,
     local cleared, re-upload can't duplicate.
  2. Settings → Sync OFF → account downloads to vault; new entry stays local. Sync ON → uploads + clears.
  3. Private entry (remote mode) → stays local, appears in Journal history + Today streak, never hits server.
  4. `curl /api/user/import` unauth → 401; garbage payload → 400, no rows.
  5. App lock: set PIN → re-lock on background → 5 wrong → forgot-gate.

---

## Touched / new files

| File | State | Role |
|------|-------|------|
| `lib/localStore.ts` | **new** | mode-aware local persistence (demo vs vault) + `loadPrivateVaultEntries` |
| `lib/syncMigration.ts` | **new** | upload/download migration helpers |
| `lib/appLock.ts` | **new** | hashed PIN lifecycle |
| `lib/demoData.ts` | mod | key-generic core, import/export payload helpers, `private` flag |
| `lib/validators.ts` | mod | `UserImportSchema` |
| `app/api/user/import/route.ts` | **new** | bulk import (transactional, IDOR-safe) |
| `app/api/user/data/route.ts` | **new** | data-only server wipe |
| `app/api/user/app-lock/reset/route.ts` | **new** | reset email **stub** |
| `components/AppLockProvider.tsx` | **new** | lock gate + LockScreen + forgot-gate |
| `components/PendingEntryMigrator.tsx` | **new** | sign-in upload offer |
| `components/PreferencesProvider.tsx` | mod | `storageMode`/`dataMode`/`useDataMode` |
| `components/SettingsScreen.tsx` | mod | "Privacy & control" group: Storage & sync, App lock, Private entries, transparency, export/delete, server-wipe |
| `components/ProfileScreen.tsx` | mod | "App settings" bridge copy mentions privacy controls |
| `components/JournalScreen.tsx` | mod | `remote` branch + private toggle/save/history-merge/badges (Slice 5 done) |
| `components/today/useTodayData.ts` | mod | `dataMode` + private-vault merge (done) |
| `components/today/widgets.tsx`, `GoalsSection.tsx`, `TasksScreen.tsx`, `RemindersScreen.tsx`, `ScheduleScreen.tsx` | mod | `dataMode` refactor |
| `types/index.ts` | mod | `StorageMode`, `DataMode`, `JournalEntry.private?` |
| `app/page.tsx` | mod | signed-out `/` → `/landing` (prior task) |

---

## Gotchas carried from CLAUDE.md
- **`db:push`, not `db:migrate`** (migration lock is sqlite, DB is Neon Postgres → P3019). No schema
  change needed for this feature — `private` is client-only, no new DB columns.
- **Deploy via `npx vercel --prod --yes`** (Git auto-deploy broken since repo rename). Push to origin too.
- **Never deploy until verified in local dev** (Aarrav's rule). Address the user as **Aarrav**.
- App-lock reset email is a **stub** — gate/counter/lockout work; mailer is the TODO.

---

## Appendix — original audit prompt (kept from the pre-handoff version of this file)

> The following was the prior content of this file — a multi-part architecture/security/NLP/privacy
> audit prompt for "Progress". Retained so it isn't lost.

Act as a Principal Software Architect, Lead Cyber Security Engineer, Senior NLP Specialist, and Privacy/Compliance Reviewer — comprehensive multi-layer evaluation across: (1) Defensive security & hardening (localStorage↔DB transitions, state/storage hardening, input validation/rendering, access control scoping), (2) Architecture & performance (state coupling, streak/date logic, demo-state code debt), (3) Local NLP fallback engine direction A vs B (in-place `lib/parser.ts` improvement vs new mood/sentiment layer), (4) Privacy Policy & Terms review (Groq/Gemini/Google OAuth/Neon/Vercel processors, PIPEDA + GDPR), (5) Gemini analysis prompt engineering (edge cases, dedup, versioned prompt). Findings ranked Critical/Important/Minor; ask before making product decisions.
