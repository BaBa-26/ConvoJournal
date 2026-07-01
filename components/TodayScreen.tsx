"use client";

import { usePreferences } from "@/components/PreferencesProvider";
import DaybreakLayout from "@/components/today/DaybreakLayout";
import HearthLayout from "@/components/today/HearthLayout";
import MosaicLayout from "@/components/today/MosaicLayout";

export default function TodayScreen() {
  const { prefs } = usePreferences();

  switch (prefs.themeLayout) {
    case "hearth":
      return <HearthLayout />;
    case "mosaic":
      return <MosaicLayout />;
    case "daybreak":
    default:
      return <DaybreakLayout />;
  }
}
