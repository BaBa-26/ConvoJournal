"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_PREFERENCES } from "@/types";
import type { UserPreferences, StorageMode, DataMode } from "@/types";
import { preferenceCssVars, resolveBackground } from "@/lib/theme";
import { loadDemoPreferences, updateDemoPreferences } from "@/lib/demoData";
import { setActiveLocalKind } from "@/lib/localStore";

// Per-device storage choice (NOT synced with the account — it's a "keep on THIS device" flag).
const STORAGE_MODE_KEY = "progress:storageMode";

function readStorageMode(): StorageMode {
  if (typeof window === "undefined") return "sync";
  try {
    return window.localStorage.getItem(STORAGE_MODE_KEY) === "local" ? "local" : "sync";
  } catch {
    return "sync";
  }
}

interface PreferencesContextValue {
  prefs: UserPreferences;          // working prefs = saved + unsaved draft (what the app renders)
  loaded: boolean;
  hasUnsaved: boolean;
  patchPrefs: (patch: Partial<UserPreferences>) => void;   // apply live AND persist immediately
  stagePrefs: (patch: Partial<UserPreferences>) => void;   // apply live, do NOT persist yet
  commitPrefs: () => void;                                  // persist the staged draft
  revertPrefs: () => void;                                  // drop the staged draft
  storageMode: StorageMode;                                 // per-device sync preference
  setStorageMode: (mode: StorageMode) => void;              // persist + broadcast the choice
  dataMode: DataMode;                                       // resolved backing source ("remote" | "local")
}

const PreferencesContext = createContext<PreferencesContextValue>({
  prefs: DEFAULT_PREFERENCES,
  loaded: false,
  hasUnsaved: false,
  patchPrefs: () => {},
  stagePrefs: () => {},
  commitPrefs: () => {},
  revertPrefs: () => {},
  storageMode: "sync",
  setStorageMode: () => {},
  dataMode: "local",
});

export function usePreferences() {
  return useContext(PreferencesContext);
}

// Convenience accessor for screens that only care about where data lives.
export function useDataMode(): DataMode {
  return useContext(PreferencesContext).dataMode;
}

export default function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [saved, setSaved] = useState<UserPreferences>(DEFAULT_PREFERENCES); // last persisted
  const [draft, setDraft] = useState<Partial<UserPreferences> | null>(null); // unsaved overrides
  const [loaded, setLoaded] = useState(false);
  const [storageMode, setStorageModeState] = useState<StorageMode>("sync");

  const statusRef = useRef(status);
  statusRef.current = status;

  // Keep the active local store in sync with auth, set during render so children's data-loading
  // effects (which run before this parent's effects on mount) read the correct backing store:
  // signed-in local data always lives in the persistent vault; signed-out uses the ephemeral
  // demo store. (storageMode doesn't affect *which* local store — only whether we read local at all.)
  setActiveLocalKind(status === "authenticated" ? "vault" : "demo");

  // Resolved data source the app reads/writes: remote only when signed in AND syncing.
  const dataMode: DataMode = status === "authenticated" && storageMode === "sync" ? "remote" : "local";

  // Hydrate the per-device storage choice + keep it in step across tabs.
  useEffect(() => {
    setStorageModeState(readStorageMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_MODE_KEY) setStorageModeState(readStorageMode());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setStorageMode = useCallback((mode: StorageMode) => {
    try {
      window.localStorage.setItem(STORAGE_MODE_KEY, mode);
    } catch {}
    setStorageModeState(mode);
  }, []);

  // Load persisted preferences once auth status is known.
  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;

    if (status === "authenticated") {
      fetch("/api/user/preferences")
        .then((r) => (r.ok ? r.json() : DEFAULT_PREFERENCES))
        .catch(() => DEFAULT_PREFERENCES)
        .then((p: UserPreferences) => {
          if (!cancelled) {
            setSaved({ ...DEFAULT_PREFERENCES, ...p });
            setLoaded(true);
          }
        });
    } else {
      setSaved(loadDemoPreferences());
      setLoaded(true);
    }

    return () => {
      cancelled = true;
    };
  }, [status]);

  // Persist a patch to the backing store (server when authed, localStorage in demo mode).
  const persist = useCallback((patch: Partial<UserPreferences>) => {
    if (statusRef.current === "authenticated") {
      fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((server: UserPreferences | null) => {
          if (server) setSaved((prev) => ({ ...prev, ...server }));
        })
        .catch(() => {});
    } else {
      updateDemoPreferences(patch);
    }
  }, []);

  // Immediate apply + persist (used outside the Settings save-gate, e.g. Today inline editing).
  const patchPrefs = useCallback(
    (patch: Partial<UserPreferences>) => {
      setSaved((prev) => ({ ...prev, ...patch }));
      persist(patch);
    },
    [persist]
  );

  // Stage: apply live to the working prefs (previews everywhere) but do not persist.
  const stagePrefs = useCallback((patch: Partial<UserPreferences>) => {
    setDraft((d) => ({ ...(d ?? {}), ...patch }));
  }, []);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const commitPrefs = useCallback(() => {
    const cur = draftRef.current;
    if (cur && Object.keys(cur).length) {
      setSaved((prev) => ({ ...prev, ...cur }));
      persist(cur);
    }
    setDraft(null);
  }, [persist]);

  const revertPrefs = useCallback(() => setDraft(null), []);

  // What the whole app renders: saved with any unsaved draft layered on top.
  const prefs = useMemo(() => (draft ? { ...saved, ...draft } : saved), [saved, draft]);

  const hasUnsaved = useMemo(() => {
    if (!draft) return false;
    return (Object.keys(draft) as (keyof UserPreferences)[]).some(
      (k) => JSON.stringify(draft[k]) !== JSON.stringify(saved[k])
    );
  }, [draft, saved]);

  // Color mode is a global app preference (applies to every screen / layout).
  const colorMode = prefs.colorMode === "light" ? "light" : "dark";
  const background = resolveBackground(prefs.backgroundImage);

  // Mirror color mode + background presence + surface style onto <html> so the page shell
  // (body bg), the .today-surface transparency, and the translucent-card rule all respond.
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-color-mode", colorMode);
    el.setAttribute("data-surface", prefs.surfaceStyle);
    if (background) el.setAttribute("data-has-bg", "true");
    else el.removeAttribute("data-has-bg");
  }, [colorMode, background, prefs.surfaceStyle]);

  return (
    <PreferencesContext.Provider
      value={{
        prefs,
        loaded,
        hasUnsaved,
        patchPrefs,
        stagePrefs,
        commitPrefs,
        revertPrefs,
        storageMode,
        setStorageMode,
        dataMode,
      }}
    >
      {/* Fixed wallpaper + a light readability scrim, behind all content, only when a background is set.
          The scrim is intentionally light (0.4) so the image reads clearly; cards carry text contrast. */}
      {background && (
        <>
          <div className="fixed inset-0 -z-20 pointer-events-none" style={{ background }} aria-hidden />
          <div
            className="fixed inset-0 -z-10 pointer-events-none"
            style={{ background: "hsl(var(--background) / 0.4)" }}
            aria-hidden
          />
        </>
      )}
      {/* display:contents wrapper keeps in-app content themed with no SSR flash. */}
      <div style={{ display: "contents", ...preferenceCssVars(prefs) }} data-color-mode={colorMode}>
        {children}
      </div>
    </PreferencesContext.Provider>
  );
}
