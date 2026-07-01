"use client";

import Link from "next/link";
import { useTodayData } from "./useTodayData";
import { useTodayHeader } from "./useTodayHeader";
import { usePreferences } from "@/components/PreferencesProvider";
import { AgendaList, StreakHeatmap, WeeklyStats, TonightCTA, RecentReflections } from "./widgets";

export default function HearthLayout() {
  const data = useTodayData();
  const { dateLabel, greetWord, firstName, reminderLabel } = useTodayHeader();
  const { prefs } = usePreferences();

  // Hearth keeps its curated narrative order (its look is hero-driven), but respects hide/show.
  const shown = (key: string) => !prefs.hiddenWidgets.includes(key as never);

  return (
    <div className="flex flex-col flex-1 overflow-hidden today-surface text-foreground animate-fade-in">
      <div className="flex-1 overflow-y-auto pb-nav">
        {/* Hero with radial sun glow */}
        <header className="relative px-5 pt-safe pt-6 pb-5 overflow-hidden flex-shrink-0">
          <div
            className="absolute -top-9 -right-2 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, color-mix(in oklab, rgb(var(--accent)) 60%, transparent) 0%, transparent 68%)" }}
          />
          <p className="relative font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{dateLabel}</p>
          <h1
            className="relative font-display italic font-semibold text-foreground leading-tight mt-2"
            style={{ fontSize: "calc(2.05rem * var(--type-scale))" }}
          >
            {greetWord},<br />
            {firstName}.
          </h1>
          <p className="relative font-mono text-xs text-muted-foreground leading-relaxed mt-3 max-w-[250px]">
            {data.streakCount > 1
              ? `You've shown up ${data.streakCount} days running. Tonight's page is waiting.`
              : "Tonight's page is waiting."}
          </p>
        </header>

        <div className="px-5 flex flex-col gap-4">
          {shown("tonight") && (
            <TonightCTA
              kicker="Tonight's reflection"
              cta="Begin tonight's entry"
              reminderLabel={reminderLabel}
              reminderPrefix="we'll nudge you at"
            />
          )}
          {shown("agenda") && <AgendaList items={data.agendaItems} title="Still on today" />}
          {shown("streak") && (
            <StreakHeatmap
              days={data.streakDays}
              streakCount={data.streakCount}
              label="Your streak"
              footer={shown("stats") ? <WeeklyStats stats={data.weekStats} inline /> : undefined}
            />
          )}
          {shown("recent") && <RecentReflections entries={data.recentEntries} label="From the archive" />}

          <Link
            href="/settings"
            className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.18em] text-center hover:text-foreground transition-colors"
          >
            profile &amp; settings →
          </Link>
        </div>
      </div>
    </div>
  );
}
