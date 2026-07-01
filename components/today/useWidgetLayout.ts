"use client";

import { useEffect, useMemo, useState } from "react";
import { usePreferences } from "@/components/PreferencesProvider";
import { WIDGET_KEYS } from "@/types";
import type { WidgetKey, UserPreferences } from "@/types";

// Shared widget arranging state for the Today layouts and the Settings preview.
// Wraps prefs.widgetOrder / hiddenWidgets: keeps a local draggable order, commits it to
// prefs on drag-end / edit-exit, and toggles hidden widgets. Newly-shipped widget keys are
// appended to the effective order so an older saved order never leaves a widget invisible.
//
// `write` controls how changes are applied: default is `patchPrefs` (persist immediately, used
// by the Today layouts). The Settings studio passes `stagePrefs` so its edits join the save-gate.
export function useWidgetLayout(write?: (patch: Partial<UserPreferences>) => void) {
  const { prefs, patchPrefs } = usePreferences();
  const apply = write ?? patchPrefs;

  const effectiveOrder = useMemo<WidgetKey[]>(() => {
    const stored = prefs.widgetOrder.filter((k) => WIDGET_KEYS.includes(k));
    const missing = WIDGET_KEYS.filter((k) => !stored.includes(k));
    return [...stored, ...missing];
  }, [prefs.widgetOrder]);

  const [order, setOrder] = useState<WidgetKey[]>(effectiveOrder);
  useEffect(() => setOrder(effectiveOrder), [effectiveOrder]);

  const [editing, setEditing] = useState(false);

  const commit = (next: WidgetKey[] = order) => apply({ widgetOrder: next });

  const toggleEditing = () => {
    if (editing) commit();
    setEditing((e) => !e);
  };

  const toggleHidden = (key: WidgetKey) => {
    const hidden = prefs.hiddenWidgets.includes(key);
    apply({
      hiddenWidgets: hidden
        ? prefs.hiddenWidgets.filter((k) => k !== key)
        : [...prefs.hiddenWidgets, key],
    });
  };

  return {
    order,
    setOrder,
    editing,
    setEditing,
    toggleEditing,
    commit,
    toggleHidden,
    hiddenWidgets: prefs.hiddenWidgets,
  };
}
