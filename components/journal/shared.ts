// Shared bits for the journal phase components.

export const PRIORITY_COLORS: Record<string, string> = {
  high: "#c87a6a",
  medium: "#c8a860",
  low: "#7a9a7a",
};

// Mood → quiet glyph (brand geometry, no emoji fonts)
export function moodEmoji(mood: string): string {
  const m = mood.toLowerCase();
  if (/happy|joy|great|good/.test(m)) return "☀";
  if (/sad|down|low/.test(m)) return "◌";
  if (/stress|anxious|worried|overwhelm/.test(m)) return "◈";
  if (/energet|motiv/.test(m)) return "⚡";
  if (/tired|exhaust/.test(m)) return "◐";
  if (/reflect|thought/.test(m)) return "✦";
  if (/excited|thrilled/.test(m)) return "✧";
  return "◎";
}
