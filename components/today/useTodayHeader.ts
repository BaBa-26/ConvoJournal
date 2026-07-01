"use client";

import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { usePreferences } from "@/components/PreferencesProvider";
import { formatReminderLabel } from "@/lib/theme";

export interface TodayHeader {
  dateLabel: string;     // "TUESDAY, JUNE 30"
  greetWord: string;     // "Good morning"
  firstName: string;
  reminderLabel: string | null;
  typeScaleStyle: React.CSSProperties; // apply to the greeting headline
}

export function useTodayHeader(): TodayHeader {
  const { data: session } = useSession();
  const { prefs } = usePreferences();

  const h = new Date().getHours();
  const greetWord = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  const name = (prefs.displayName || session?.user?.name || "there").trim();
  const firstName = name.split(" ")[0] || "there";

  return {
    dateLabel: format(new Date(), "EEEE, MMMM d").toUpperCase(),
    greetWord,
    firstName,
    reminderLabel: formatReminderLabel(prefs.reminderTime),
    typeScaleStyle: { fontSize: "calc(1.75rem * var(--type-scale))" },
  };
}
