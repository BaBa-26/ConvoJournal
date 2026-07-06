"use client";

import Link from "next/link";
import { useTodayData } from "./useTodayData";
import { useTodayHeader } from "./useTodayHeader";
import { useWidgetLayout } from "./useWidgetLayout";
import EditableWidgetStack from "./EditableWidgetStack";
import { usePreferences } from "@/components/PreferencesProvider";
import type { WidgetKey } from "@/types";
import {
  AgendaList,
  StreakHeatmap,
  WeeklyStats,
  TonightCTA,
  TomorrowPreview,
  RecentReflections,
} from "./widgets";

export default function DaybreakLayout() {
  const data = useTodayData();
  const { dateLabel, greetWord, firstName, reminderLabel, typeScaleStyle } = useTodayHeader();
  const { prefs, patchPrefs } = usePreferences();
  const { order, setOrder, editing, toggleEditing, commit, toggleHidden, hiddenWidgets } =
    useWidgetLayout();

  const render: Record<WidgetKey, React.ReactNode> = {
    tonight: <TonightCTA reminderLabel={reminderLabel} />,
    agenda: <AgendaList items={data.agendaItems} />,
    stats: <WeeklyStats stats={data.weekStats} />,
    streak: <StreakHeatmap days={data.streakDays} streakCount={data.streakCount} />,
    tomorrow: <TomorrowPreview tasks={data.tasks} reminders={data.reminders} />,
    recent: <RecentReflections entries={data.recentEntries} />,
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden today-surface text-foreground animate-fade-in">
      <header className="px-5 pt-safe pt-5 pb-2 flex-shrink-0">
        {/* Light / Dark toggle + Edit layout */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex gap-1 bg-muted border border-border rounded-xl p-1 w-32">
            {(["light", "dark"] as const).map((m) => (
              <button
                key={m}
                onClick={() => patchPrefs({ colorMode: m })}
                className={`flex-1 min-h-[30px] rounded-lg font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
                  prefs.colorMode === m ? "bg-accent text-onaccent" : "text-muted-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={toggleEditing}
            className={`mr-12 md:mr-0 rounded-lg px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] border transition-colors ${
              editing ? "bg-accent text-onaccent border-accent" : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {editing ? "Done" : "Edit layout"}
          </button>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">{dateLabel}</p>
        <h1 className="font-display italic font-semibold text-foreground leading-tight mt-1.5" style={typeScaleStyle}>
          {greetWord}, {firstName}.
        </h1>
        <p className="font-mono text-xs text-muted-foreground leading-relaxed mt-2">
          {data.agendaItems.length > 0
            ? `${data.agendaItems.length} on the agenda, and a quiet evening to write.`
            : "A clear day, and a quiet evening to write."}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-nav pt-2">
        {editing && (
          <p className="font-mono text-[11px] text-muted-foreground mb-3">
            Drag a card by its handle to reorder · tap hide to remove it.
          </p>
        )}

        <EditableWidgetStack
          order={order}
          hidden={hiddenWidgets}
          editing={editing}
          render={render}
          onReorder={setOrder}
          onCommit={() => commit()}
          onToggleHidden={toggleHidden}
        />

        <Link
          href="/settings"
          className="block mt-4 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.18em] text-center hover:text-foreground transition-colors"
        >
          profile &amp; settings →
        </Link>
      </div>
    </div>
  );
}
