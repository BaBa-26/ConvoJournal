# Handoff — Settings dialog refactor + Security posture

**Session date:** 2026-07-08 · **Branch:** `claude/nifty-hamilton-ISukC`
**Typecheck:** `npx tsc --noEmit` clean (exit 0). Dev server compiles; all routes serve.

> Paste into a new chat to continue. Two parts: (1) what shipped this session, (2) a security
> "lay of the land" — do you have proper protection for your users and for you/the app — plus the
> agreed next task (AI crisis modes) and a hardening backlog (RLS).

---

## Part 1 — What shipped this session

### Settings became one Claude-style dialog (was two scrolling pages)
- **Shell:** `components/settings/SettingsDialog.tsx` — desktop = left category rail + right content
  pane; mobile = drill-in (category → content → back). Escape / backdrop / ✕ close it, with a
  nested-modal-aware Escape guard (counts `[role=dialog]`) so a confirm dialog's Escape doesn't also
  close settings. Appearance edits keep the staged **save-gate** (footer Save/Discard + "Save your
  changes?" prompt on close when `hasUnsaved`).
- **Provider:** `components/settings/SettingsUIProvider.tsx` → `useSettingsUI().openSettings(cat?)` /
  `closeSettings()`; mounts the single dialog. Wrapped around the app in `app/layout.tsx` inside
  `AppLockProvider`.
- **Categories/panels** (`components/settings/panels/`): Account, Privacy & control, Appearance,
  Notifications, **Usage (placeholder "soon")**, About. Category metadata + icons live in
  `components/settings/categories.tsx`; shared `Toggle`/`Segmented` in `components/settings/controls.tsx`.

### Two quick-menus feed the dialog
- **Mobile:** `components/ProfileButton.tsx` — the pinned top-right avatar now opens a **smooth
  dropdown** of the categories; picking one opens the dialog at that section.
- **Desktop:** `components/SideNav.tsx` — the footer ⚙ Settings button opens the **same menu rising
  upward**; picking one opens the dialog. The account row still jumps straight to Account.
- Shared menu UI: `components/settings/SettingsMenuPanel.tsx` (`placement: "up" | "down"`).
- All three Today layouts' "profile & settings →" links now open the dialog too.

### Routing
- `/settings` and `/profile` still work but render `components/settings/SettingsRedirect.tsx`, which
  opens the dialog (over `/`). Deep links preserved.
- **Deleted:** `components/SettingsScreen.tsx`, `components/ProfileScreen.tsx` — fully superseded by
  the panels (content lives once now).

### Earlier in the same branch (storage/sync feature — see the Launch Readiness Checklist)
- Slice 5: private (device-only) journal entries — composer toggle, vault save, history merge, badges.
- Slice 6: grouped all trust settings under "Privacy & control".

---

## Part 2 — Security lay of the land

**Bottom line:** the app-level protections are correct and reasonably complete for launch. There is
**no database-level RLS** — isolation depends entirely on the app remembering to scope every query.
That's the one structural gap; everything below it is solid.

### A. Protecting your users (their data)

| Guard | Where | Status |
|-------|-------|--------|
| **Authentication** | `requireAuth()` at top of every data route (`lib/auth.ts:77`) | ✅ userId comes from the **server session**, never the request |
| **Tenant isolation** | every Prisma query scoped `where: { userId }`; writes hard-code `userId` | ✅ app-level (no RLS backstop — see C) |
| **IDOR re-checks** | by-id ops re-verify `findFirst({ id, userId })` (goals, journal goal-increments) | ✅ |
| **Forged-ID filtering** | Gemini `goalUpdates` filtered to the user's real goal IDs | ✅ |
| **Input validation** | Zod on all inputs (`lib/validators.ts`) — enums, `.max()`, array caps | ✅ |
| **SQL injection** | Prisma parameterizes; no raw SQL with user input | ✅ |
| **Rate limiting + headers** | `middleware.ts` sliding window + CSP/HSTS | ✅ |
| **AI prompt-injection defense** | `lib/gemini.ts` fences transcript, `sanitizeTitle`/`sanitizeField` | ✅ |
| **Data export** | `GET /api/user/export` (auth-scoped) | ✅ PIPEDA/GDPR access right |
| **Account deletion** | `DELETE /api/user` (cascade) + clears local traces | ✅ erasure right |
| **Server-copy wipe** | `DELETE /api/user/data` (data only, keeps account) | ✅ |
| **Transcript at rest** | stored in Postgres tied to userId; only over TLS | ✅ (no field-level encryption — see C) |

**This session's new server routes were audited** (`/api/user/import`, `/api/user/data`,
`/api/user/app-lock/reset`) — all auth-gated, all writes scoped to `auth.userId`, all input Zod-capped,
all Prisma-parameterized. **No HIGH/MEDIUM findings.**

### B. Protecting you / the app (legal + liability)
- **Privacy Policy** (`/privacy`) and **Terms of Service** (`/terms`) exist, linked from landing + login.
- **Processor disclosure** present (Groq / Gemini / Google OAuth / Neon / Vercel). Keep this list
  accurate as vendors change — it's your PIPEDA/GDPR basis.
- **Data-rights controls** shipped (export + delete + server-wipe) — the concrete backing for the
  policy's promises.
- ⚠️ **Safety/duty-of-care gap → the crisis-modes task.** A journaling app *will* receive entries about
  self-harm / crisis. Right now the AI just extracts tasks; it has no crisis-detection or resource
  response. That's both a user-safety and a liability concern → **next session** (see Part 3).
- App lock is a **device convenience gate**, not encryption — don't describe it as securing data at rest.
- App-lock reset route is a **stub** (logs intent, no email). When wiring it, use a short-lived signed
  token to the account email.

### C. The one structural gap — no Row-Level Security (RLS)
The DB trusts a single `DATABASE_URL` role completely. If any future query forgets `where: { userId }`,
the database will return/modify other users' rows — there is no backstop. This is a standard tradeoff,
not a current hole (today's queries are correctly scoped), but RLS is the defense-in-depth upgrade.

#### RLS hardening sketch (future task — do NOT bundle into this branch)
1. **Policies (raw SQL, app tables only — NOT the NextAuth tables):** store as `prisma/rls.sql`,
   apply with `psql "$DIRECT_URL" -f prisma/rls.sql`. Re-run after any `db:push` that recreates a table.
   ```sql
   ALTER TABLE "JournalEntry" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "JournalEntry" FORCE  ROW LEVEL SECURITY;   -- app role owns the table, so FORCE is required
   DROP POLICY IF EXISTS tenant_isolation ON "JournalEntry";
   CREATE POLICY tenant_isolation ON "JournalEntry"
     USING      ("userId" = current_setting('app.user_id', true))
     WITH CHECK ("userId" = current_setting('app.user_id', true));
   ```
   Repeat for `Task`, `Reminder`, `Goal`. `current_setting(..., true)` returns NULL if unset →
   **fail-closed** (no context ⇒ zero rows). Exclude `User`/`Account`/`Session`/`VerificationToken`
   (PrismaAdapter runs with no user context and would break).
2. **Set the context per request** (must share the connection ⇒ wrap in a transaction; works with
   Neon's pooled URL / transaction pooling):
   ```ts
   // lib/db.ts
   export function withUser<T>(userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
     return prisma.$transaction(async (tx) => {
       await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
       return fn(tx);
     });
   }
   ```
   Then every data route: `await withUser(auth.userId, (tx) => tx.journalEntry.findMany())`.
3. **Keep the app-level `where: { userId }`** too — RLS is the backstop, not a replacement (also helps
   the query planner). 
4. **Cost:** every data query must route through `withUser` or it fail-closes to empty; small per-request
   latency (tx + one `set_config`). Mechanical but touches every route.

#### Other future hardening (nice-to-have, not blockers)
- Field-level encryption for journal `rawContent` if you ever want the DB operator to not read entries.
- Wire the app-lock reset mailer (signed short-lived token).
- Consider a stricter CSP report-only pass once features settle.

---

## Part 3 — Next session (agreed): AI analysis **crisis modes**
Solidify how the AI analysis handles **crisis / high-risk content** in an entry (self-harm, suicidal
ideation, abuse, acute distress). Today `lib/gemini.ts` only extracts tasks/reminders/goals; it does not
detect or respond to crisis language. Scope to define next time:
- **Detection:** add a crisis signal to the analysis schema (e.g. `riskLevel` / `riskFlags`) — decide
  Gemini-classified vs. a deterministic keyword pre-filter (or both, fail-safe toward showing help).
- **Response UX:** what the app shows (region-aware helpline resources, a calm supportive card) instead
  of/above the normal task extraction. Never block the user from journaling.
- **Privacy:** crisis flags are sensitive — decide whether they persist at all, and keep them out of any
  analytics.
- **Guardrails:** must survive prompt injection and the existing fallback path (`lib/parser.ts` has no AI —
  decide its crisis behavior too).
- **Liability tie-in:** align the Terms/Privacy copy with whatever the app does here.

---

## Verify + deploy status
- ✅ `npx tsc --noEmit` clean. ✅ `npm run dev` compiles; `/ /settings /profile /landing /journal /tasks`
  all serve, no compile/runtime errors. (The `Invalid URL` log lines are the known Windows `/icon` /
  OG-image quirk — Linux/Vercel builds fine.)
- 🔲 **Still needs a real browser click-through** (Aarrav's standing rule: no deploy until verified in
  local dev): open dialog on desktop + mobile, drill-in + back, the two quick-menus, appearance
  save-gate, and each confirm modal.
- **Deploy:** `npx vercel --prod --yes` (Git auto-deploy broken since the repo rename). No schema change
  this session, so no `db:push` needed.
