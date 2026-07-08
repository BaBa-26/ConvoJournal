"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSettingsUI } from "./SettingsUIProvider";
import type { SettingsCategory } from "./SettingsDialog";

// Deep-link bridge: /settings and /profile still work, but now open the settings dialog
// (over the home screen) instead of rendering standalone pages.
export default function SettingsRedirect({ category }: { category?: SettingsCategory }) {
  const router = useRouter();
  const { openSettings } = useSettingsUI();

  useEffect(() => {
    openSettings(category ?? null);
    router.replace("/");
  }, [openSettings, router, category]);

  return null;
}
