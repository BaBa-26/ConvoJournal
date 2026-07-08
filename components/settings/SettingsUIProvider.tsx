"use client";

import { createContext, useCallback, useContext, useState } from "react";
import SettingsDialog, { type SettingsCategory } from "./SettingsDialog";

interface SettingsUIContextValue {
  openSettings: (category?: SettingsCategory | null) => void;
  closeSettings: () => void;
}

const SettingsUIContext = createContext<SettingsUIContextValue>({
  openSettings: () => {},
  closeSettings: () => {},
});

export function useSettingsUI() {
  return useContext(SettingsUIContext);
}

// Owns the single app-wide settings dialog and exposes open/close to any trigger (nav buttons,
// the mobile avatar, deep-link redirects from /settings and /profile).
export default function SettingsUIProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SettingsCategory | null>(null);

  const openSettings = useCallback((cat: SettingsCategory | null = null) => {
    setCategory(cat);
    setOpen(true);
  }, []);

  const closeSettings = useCallback(() => setOpen(false), []);

  return (
    <SettingsUIContext.Provider value={{ openSettings, closeSettings }}>
      {children}
      <SettingsDialog open={open} initialCategory={category} onClose={closeSettings} />
    </SettingsUIContext.Provider>
  );
}
