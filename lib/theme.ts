import type { UserPreferences, TypeScale } from "@/types";
import { TYPE_SCALE_VALUE, BACKGROUND_PRESETS } from "@/types";

// RGB-channel forms of each preset accent (+ light/dark variants), so they can be
// dropped straight into the `--accent*` CSS vars that Tailwind's `accent` token reads
// as `rgb(var(--accent) / <alpha-value>)`. Channels (not hex) are required for the
// `/opacity` Tailwind modifiers used across the app.
// `deep` is the text-safe shade used for accent-colored TEXT in light mode
// (base accent on cream fails contrast); dark mode keeps the base. See --accent-ink.
const ACCENT_RGB: Record<string, { base: string; light: string; dark: string; deep: string }> = {
  "#c8a878": { base: "200 168 120", light: "216 188 152", dark: "168 136 88", deep: "111 88 54" },   // gold (default)
  "#c87a6a": { base: "200 122 106", light: "214 150 136", dark: "168 96 82", deep: "138 68 54" },    // clay
  "#7a9a7a": { base: "122 154 122", light: "150 178 150", dark: "96 126 96", deep: "62 92 62" },     // sage
  "#6f9bd1": { base: "111 155 209", light: "146 182 224", dark: "88 126 176", deep: "50 88 134" },   // dusk blue
  "#b07ab0": { base: "176 122 176", light: "198 152 198", dark: "144 96 144", deep: "110 62 110" },  // mauve
};

const DEFAULT_ACCENT = ACCENT_RGB["#c8a878"];

export function accentChannels(accentColor: string | null) {
  return (accentColor && ACCENT_RGB[accentColor]) || DEFAULT_ACCENT;
}

export function typeScaleValue(scale: TypeScale): number {
  return TYPE_SCALE_VALUE[scale] ?? 1;
}

// "20:30" → "8:30 PM". Returns null for empty/invalid input.
export function formatReminderLabel(time: string | null): string | null {
  if (!time) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = m[2];
  const ap = hh < 12 ? "AM" : "PM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${mm} ${ap}`;
}

// Resolve a stored `backgroundImage` value into a CSS `background` string, or null when unset.
// `preset:<key>` → the preset's gradient; a data URL → a centered, cover-fit `url(...)`.
export function resolveBackground(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("preset:")) {
    const key = value.slice("preset:".length);
    return BACKGROUND_PRESETS.find((p) => p.key === key)?.css ?? null;
  }
  if (value.startsWith("data:image/")) {
    return `center / cover no-repeat url("${value}")`;
  }
  return null;
}

// The inline CSS custom properties to apply on the app wrapper for a given preference set.
export function preferenceCssVars(prefs: UserPreferences): React.CSSProperties {
  const a = accentChannels(prefs.accentColor);
  return {
    ["--accent" as string]: a.base,
    ["--accent-light" as string]: a.light,
    ["--accent-dark" as string]: a.dark,
    ["--accent-deep" as string]: a.deep,
    ["--type-scale" as string]: String(typeScaleValue(prefs.typeScale)),
  };
}
