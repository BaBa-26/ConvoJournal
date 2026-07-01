"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_PROFILE, resetDemoState } from "@/lib/demoData";
import { usePreferences } from "@/components/PreferencesProvider";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { ACCENT_SWATCHES, BACKGROUND_PRESETS } from "@/types";
import type { TypeScale, ThemeLayout, ColorMode, WidgetKey, SurfaceStyle } from "@/types";
import { resolveBackground } from "@/lib/theme";
import { useTodayData } from "@/components/today/useTodayData";
import { useTodayHeader } from "@/components/today/useTodayHeader";
import { useWidgetLayout } from "@/components/today/useWidgetLayout";
import EditableWidgetStack from "@/components/today/EditableWidgetStack";
import {
  AgendaList,
  StreakHeatmap,
  WeeklyStats,
  TonightCTA,
  TomorrowPreview,
  RecentReflections,
} from "@/components/today/widgets";

const TYPE_LABELS: Record<TypeScale, string> = { sm: "S", md: "M", lg: "L" };

function Segmented<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex gap-1.5 bg-ink-900 rounded-xl p-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 rounded-lg text-[10px] font-mono uppercase tracking-widest min-h-[36px] capitalize transition-all ${
            value === opt ? "bg-ink-700 text-parchment-200 shadow-sm" : "text-parchment-700 hover:text-parchment-500"
          }`}
        >
          {labels?.[opt] ?? opt}
        </button>
      ))}
    </div>
  );
}

// Downscale an uploaded image to a bounded JPEG data URL so it stays small enough for
// demo-mode localStorage (~5 MB quota) and the DB text column.
async function fileToDownscaledDataUrl(file: File, maxDim = 1280, quality = 0.8): Promise<string> {
  const readAsDataUrl = (f: File) =>
    new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => rej(new Error("read failed"));
      fr.readAsDataURL(f);
    });

  const src = await readAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("decode failed"));
    i.src = src;
  });

  let { width, height } = img;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

// Live preview + drag-to-arrange, mirroring the real Today widgets. Edits persist globally.
function LayoutStudio() {
  const data = useTodayData();
  const { greetWord, firstName } = useTodayHeader();
  const { prefs, stagePrefs } = usePreferences();
  // Stage widget edits so they join the Settings save-gate (not persisted until Save).
  const { order, setOrder, editing, toggleEditing, commit, toggleHidden, hiddenWidgets } =
    useWidgetLayout(stagePrefs);

  const bg = resolveBackground(prefs.backgroundImage);

  const render: Record<WidgetKey, React.ReactNode> = {
    tonight: <TonightCTA reminderLabel={null} />,
    agenda: <AgendaList items={data.agendaItems} />,
    stats: <WeeklyStats stats={data.weekStats} />,
    streak: <StreakHeatmap days={data.streakDays} streakCount={data.streakCount} />,
    tomorrow: <TomorrowPreview tasks={data.tasks} reminders={data.reminders} />,
    recent: <RecentReflections entries={data.recentEntries} />,
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-mono text-xs text-parchment-600">Arrange widgets</label>
        <button
          onClick={toggleEditing}
          className={`rounded-lg px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] border transition-colors ${
            editing ? "bg-accent text-onaccent border-accent" : "bg-ink-800 text-parchment-600 border-ink-600"
          }`}
        >
          {editing ? "Done" : "Edit layout"}
        </button>
      </div>

      <p className="font-mono text-[11px] text-parchment-700">
        {editing
          ? "Drag a card by its handle to reorder · tap hide to remove it."
          : "A live preview of your Today screen — reflects your background & widget style."}
      </p>

      {/* Sample screen — mirrors the real Today surface, wallpaper included. */}
      <div
        className="rounded-2xl border border-border overflow-hidden max-h-[440px] overflow-y-auto"
        style={{ background: bg ?? "hsl(var(--background))" }}
      >
        <div className="p-3" style={bg ? { background: "hsl(var(--background) / 0.4)" } : undefined}>
          <p
            className="font-display italic font-semibold text-foreground mb-3"
            style={bg ? { textShadow: "0 1px 16px hsl(var(--background)), 0 0 3px hsl(var(--background))" } : undefined}
          >
            {greetWord}, {firstName}.
          </p>
          <EditableWidgetStack
            order={order}
            hidden={hiddenWidgets}
            editing={editing}
            render={render}
            onReorder={setOrder}
            onCommit={() => commit()}
            onToggleHidden={toggleHidden}
          />
        </div>
      </div>
    </div>
  );
}

export default function SettingsScreen() {
  const { data: session } = useSession();
  const router = useRouter();
  const { prefs, stagePrefs, commitPrefs, revertPrefs, hasUnsaved } = usePreferences();
  const [resetting, setResetting] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prompt before leaving Settings with unsaved edits.
  const onBlockedNav = useCallback((href: string) => setPendingHref(href), []);
  useUnsavedChangesGuard(hasUnsaved, onBlockedNav);

  // Safety net: if the screen unmounts while still dirty (e.g. browser back), drop the draft.
  useEffect(() => () => revertPrefs(), [revertPrefs]);

  const saveAndGo = () => {
    commitPrefs();
    if (pendingHref) {
      const href = pendingHref;
      setPendingHref(null);
      router.push(href);
    }
  };
  const discardAndGo = () => {
    revertPrefs();
    const href = pendingHref;
    setPendingHref(null);
    if (href) router.push(href);
  };

  const handleReset = () => {
    setResetting(true);
    resetDemoState();
    router.refresh();
    setTimeout(() => setResetting(false), 300);
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const dataUrl = await fileToDownscaledDataUrl(file);
      if (dataUrl.length > 2_900_000) {
        setUploadError("Image is too large even after resizing — try a smaller one.");
      } else {
        stagePrefs({ backgroundImage: dataUrl });
      }
    } catch {
      setUploadError("Couldn't process that image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const nameValue = nameDraft ?? prefs.displayName ?? session?.user?.name ?? "";
  const currentBg = prefs.backgroundImage;

  return (
    <div className="flex flex-col flex-1 overflow-hidden animate-fade-in">
      <header className="px-5 pt-safe pt-5 pb-4 flex-shrink-0">
        <p className="font-mono text-[10px] text-parchment-700 uppercase tracking-[0.2em]">profile / settings</p>
        <h1 className="font-display italic text-2xl text-parchment-100 leading-tight mt-1">keep the app tuned</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-nav space-y-4">
        {/* ── Personalize ─────────────────────────────────────── */}
        <section className="card space-y-4">
          <p className="label">Personalize</p>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-parchment-600">Name</label>
            <input
              className="input"
              value={nameValue}
              placeholder="Your name"
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                const v = (nameDraft ?? "").trim();
                if (nameDraft !== null && v) stagePrefs({ displayName: v });
                setNameDraft(null);
              }}
            />
          </div>

          {/* Accent */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-parchment-600">Accent color</label>
            <div className="flex gap-3">
              {ACCENT_SWATCHES.map((hex) => {
                const active = (prefs.accentColor ?? ACCENT_SWATCHES[0]) === hex;
                return (
                  <button
                    key={hex}
                    onClick={() => stagePrefs({ accentColor: hex })}
                    aria-label={`Accent ${hex}`}
                    className="w-9 h-9 rounded-full transition-transform active:scale-95"
                    style={{
                      background: hex,
                      border: `2px solid ${active ? "#f0e4cc" : "transparent"}`,
                      boxShadow: active ? "0 0 0 2px #1a1815" : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Type size */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-parchment-600">Text size</label>
            <Segmented<TypeScale>
              options={["sm", "md", "lg"]}
              value={prefs.typeScale}
              onChange={(v) => stagePrefs({ typeScale: v })}
              labels={TYPE_LABELS}
            />
          </div>

          {/* Reminder time */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-parchment-600">Daily reflection reminder</label>
            <input
              type="time"
              className="input"
              value={prefs.reminderTime ?? ""}
              onChange={(e) => stagePrefs({ reminderTime: e.target.value || null })}
            />
          </div>

          {/* Appearance — global light/dark */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-parchment-600">Appearance (whole app)</label>
            <Segmented<ColorMode>
              options={["light", "dark"]}
              value={prefs.colorMode}
              onChange={(v) => stagePrefs({ colorMode: v })}
            />
          </div>
        </section>

        {/* ── Layout ──────────────────────────────────────────── */}
        <section className="card space-y-4">
          <p className="label">Today layout</p>

          <Segmented<ThemeLayout>
            options={["daybreak", "hearth", "mosaic"]}
            value={prefs.themeLayout}
            onChange={(v) => stagePrefs({ themeLayout: v })}
          />

          <LayoutStudio />
        </section>

        {/* ── Background ──────────────────────────────────────── */}
        <section className="card space-y-4">
          <p className="label">Background</p>

          <div className="grid grid-cols-3 gap-2.5">
            {/* None */}
            <button
              onClick={() => stagePrefs({ backgroundImage: null })}
              className={`h-16 rounded-xl border-2 flex items-center justify-center font-mono text-[9px] uppercase tracking-[0.12em] text-parchment-600 bg-ink-800 transition-transform active:scale-95 ${
                !currentBg ? "border-accent" : "border-ink-600"
              }`}
            >
              None
            </button>

            {/* Presets */}
            {BACKGROUND_PRESETS.map((p) => {
              const active = currentBg === `preset:${p.key}`;
              return (
                <button
                  key={p.key}
                  onClick={() => stagePrefs({ backgroundImage: `preset:${p.key}` })}
                  aria-label={p.label}
                  className={`h-16 rounded-xl border-2 relative overflow-hidden transition-transform active:scale-95 ${
                    active ? "border-accent" : "border-ink-600"
                  }`}
                  style={{ background: p.css }}
                >
                  <span className="absolute bottom-1 left-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/80 drop-shadow">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Upload */}
          <div className="space-y-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-ghost w-full"
            >
              {uploading ? "Processing…" : "Upload your own image"}
            </button>
            {currentBg?.startsWith("data:image/") && (
              <p className="font-mono text-[11px] text-parchment-700">
                Using your uploaded image.{" "}
                <button onClick={() => stagePrefs({ backgroundImage: null })} className="underline text-accent">
                  remove
                </button>
              </p>
            )}
            {uploadError && <p className="font-mono text-[11px] text-priority-high">{uploadError}</p>}
          </div>

          {/* Widget surface — solid vs translucent glass (only meaningful over a background) */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-parchment-600">Widget style</label>
            <Segmented<SurfaceStyle>
              options={["solid", "translucent"]}
              value={prefs.surfaceStyle}
              onChange={(v) => stagePrefs({ surfaceStyle: v })}
            />
            <p className="font-mono text-[11px] text-parchment-700">
              {prefs.surfaceStyle === "translucent"
                ? "Cards turn to frosted glass so the background shows through."
                : "Cards stay solid; the background shows around them."}
            </p>
          </div>
        </section>

        {/* ── Account ─────────────────────────────────────────── */}
        <section className="card space-y-3">
          <p className="label">Account</p>
          <div className="space-y-1">
            <p className="font-display italic text-lg text-parchment-200">
              {prefs.displayName ?? session?.user?.name ?? DEMO_PROFILE.name}
            </p>
            <p className="font-mono text-xs text-parchment-700">{session?.user?.email ?? DEMO_PROFILE.email}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {session ? (
              <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-ghost">
                Sign out
              </button>
            ) : (
              <button onClick={() => signIn()} className="btn-primary">
                Sign in
              </button>
            )}
            <Link href="/login" className="btn-ghost">
              Onboarding
            </Link>
          </div>
        </section>

        <section className="card space-y-3">
          <p className="label">Testing</p>
          <p className="font-mono text-sm text-parchment-300 leading-6">
            Demo mode keeps preloaded journal, task, and reminder data in local storage so you can test the app without auth.
          </p>
          <button onClick={handleReset} disabled={resetting} className="btn-primary w-full">
            {resetting ? "Resetting…" : "Reset demo data"}
          </button>
        </section>

        <section className="card space-y-2">
          <p className="label">Shortcuts</p>
          <div className="flex flex-col gap-2">
            <Link href="/" className="btn-ghost justify-start">Today</Link>
            <Link href="/journal" className="btn-ghost justify-start">Journal</Link>
            <Link href="/schedule" className="btn-ghost justify-start">Calendar</Link>
            <Link href="/tasks" className="btn-ghost justify-start">Goals</Link>
          </div>
        </section>
      </div>

      {/* Unsaved-changes save bar */}
      {hasUnsaved && (
        <div className="flex-shrink-0 mb-[4.75rem] md:mb-0 border-t border-ink-700 bg-ink-900/95 backdrop-blur px-5 py-3 pb-safe flex items-center gap-2">
          <p className="flex-1 font-mono text-[11px] text-parchment-500">Unsaved changes</p>
          <button onClick={revertPrefs} className="btn-ghost px-4 py-2 min-h-[40px]">
            Discard
          </button>
          <button onClick={commitPrefs} className="btn-primary px-5 py-2 min-h-[40px]">
            Save
          </button>
        </div>
      )}

      {/* Leave-with-unsaved-changes prompt */}
      {pendingHref && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={() => setPendingHref(null)} />
          <div className="relative card w-full max-w-sm space-y-4 animate-slide-up">
            <div className="space-y-1">
              <p className="font-display italic text-lg text-parchment-100">Save your changes?</p>
              <p className="font-mono text-xs text-parchment-600 leading-5">
                You have unsaved personalization changes. Save them to apply across the app, or discard.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={saveAndGo} className="btn-primary w-full">
                Save &amp; leave
              </button>
              <button onClick={discardAndGo} className="btn-ghost w-full">
                Discard &amp; leave
              </button>
              <button
                onClick={() => setPendingHref(null)}
                className="font-mono text-[11px] text-parchment-600 uppercase tracking-[0.15em] py-2 hover:text-parchment-400 transition-colors"
              >
                Stay on settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
