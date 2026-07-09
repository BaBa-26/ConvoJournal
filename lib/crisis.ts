// ─────────────────────────────────────────────────────────────────────────────
// Crisis-signal detection — the deterministic layer of the two-layer design.
// Runs on every entry in /api/analyze (both the Gemini path and the regex
// fallback), so crisis coverage never depends on an AI API being up.
//
// Fail-safe philosophy: a false positive costs a gentle support card; a false
// negative costs silence when someone needed help. Every ambiguity resolves
// toward showing help. Negation ("I would never hurt myself") demotes a match
// to "concern" — never to "none".
//
// Zero-retention: RiskSignal exists only in the in-flight analysis response.
// It is never persisted (DB or localStorage) and never logged.
// ─────────────────────────────────────────────────────────────────────────────

export type RiskFlag = "self_harm" | "abuse" | "violence" | "distress";
export type RiskLevel = "none" | "concern" | "crisis";

export interface RiskSignal {
  level: RiskLevel;
  flags: RiskFlag[];
}

export const NO_RISK: RiskSignal = { level: "none", flags: [] };

export const RISK_FLAGS: readonly RiskFlag[] = ["self_harm", "abuse", "violence", "distress"];
const LEVEL_RANK: Record<RiskLevel, number> = { none: 0, concern: 1, crisis: 2 };

// ── Keyword dictionaries ──────────────────────────────────────────────────────
// Two tiers per category: "crisis" = explicit, unambiguous phrasing;
// "concern" = warning-sign phrasing that warrants a gentle nudge, not a full card.

interface CategoryPatterns {
  flag: RiskFlag;
  crisis: RegExp;
  concern?: RegExp;
}

const CATEGORIES: CategoryPatterns[] = [
  {
    flag: "self_harm",
    crisis:
      /\b(?:kill(?:ing)?\s+myself|end(?:ing)?\s+my\s+life|end\s+it\s+all|suicidal?|take\s+my\s+own\s+life|hurt(?:ing)?\s+myself|harm(?:ing)?\s+myself|self[-\s]?harm|cut(?:ting)?\s+myself|(?:don'?t|do\s+not)\s+want\s+to\s+(?:live|be\s+alive|wake\s+up)|better\s+off\s+dead|no\s+reason\s+to\s+(?:live|keep\s+going)|overdos(?:e|ed|ing))\b/i,
    concern:
      /\b(?:hopeless|worthless|no\s+point\s+(?:anymore|in\s+anything)|what'?s\s+the\s+point|can'?t\s+take\s+(?:it|this)\s+anymore|can'?t\s+do\s+this\s+anymore|want\s+to\s+disappear|everyone\s+would\s+be\s+better\s+without\s+me)\b/i,
  },
  {
    flag: "abuse",
    crisis:
      /\b(?:(?:he|she|they|my\s+\w+)\s+(?:hit|hits|beat|beats|choked?|chokes|strangled?)\s+me|abus(?:ing|ed|es)\s+me|being\s+abused|sexual(?:ly)?\s+assault(?:ed)?|raped?|molest(?:ed|s)?|domestic\s+violence|threatened?\s+to\s+(?:hurt|kill)\s+me)\b/i,
    concern:
      /\b(?:afraid\s+to\s+go\s+home|scared\s+of\s+(?:him|her|them)|won'?t\s+let\s+me\s+(?:leave|see|talk)|controls?\s+everything\s+i\s+do)\b/i,
  },
  {
    flag: "violence",
    crisis:
      /\b(?:want\s+to\s+(?:hurt|kill|attack)\s+(?:him|her|them|someone|somebody|people)|going\s+to\s+(?:hurt|kill|attack)\s+(?:him|her|them|someone|somebody)|make\s+(?:him|her|them)\s+pay\s+for)\b/i,
    concern: /\b(?:so\s+angry\s+i\s+(?:could|might|can'?t)|losing\s+control|about\s+to\s+snap|rage\s+i\s+can'?t\s+control)\b/i,
  },
  {
    flag: "distress",
    crisis: /\b(?:i\s+can'?t\s+(?:cope|survive\s+this)|complete(?:ly)?\s+breakdown|nervous\s+breakdown)\b/i,
    concern:
      /\b(?:panic\s+attacks?|breaking\s+down|falling\s+apart|can'?t\s+stop\s+crying|completely\s+overwhelmed|can'?t\s+breathe\s+(?:when|thinking)|spiral(?:ing|ed)\s+(?:badly|out\s+of\s+control))\b/i,
  },
];

// Same negation idea as lib/parser.ts's negatedBefore, tuned for this job:
// look a few words back from the match for a negator ("never", "not", "don't"…).
// A negated crisis match demotes to concern — talking about NOT wanting to hurt
// yourself still often co-occurs with a hard moment, so we never drop to none.
const NEGATOR_RE =
  /\b(?:never|not|no|don'?t|do\s+not|didn'?t|did\s+not|wouldn'?t|would\s+(?:never|not)|won'?t|can'?t\s+imagine|couldn'?t\s+imagine)\s*$/i;

function negatedBefore(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 32), index);
  const lastWords = window.split(/\s+/).slice(-4).join(" ");
  return NEGATOR_RE.test(lastWords);
}

// ── Detection ─────────────────────────────────────────────────────────────────

export function detectCrisisSignals(text: string): RiskSignal {
  if (!text) return NO_RISK;

  let level: RiskLevel = "none";
  const flags = new Set<RiskFlag>();

  for (const cat of CATEGORIES) {
    // Crisis-tier match: full level unless negated right before (→ concern).
    const crisisMatch = cat.crisis.exec(text);
    if (crisisMatch) {
      flags.add(cat.flag);
      const demoted = negatedBefore(text, crisisMatch.index);
      const matchLevel: RiskLevel = demoted ? "concern" : "crisis";
      if (LEVEL_RANK[matchLevel] > LEVEL_RANK[level]) level = matchLevel;
      continue; // category already flagged at its strongest tier
    }
    // Concern-tier match: no negation demotion — concern is already the floor,
    // and a negated warning sign still warrants the gentle variant (fail-safe).
    if (cat.concern?.test(text)) {
      flags.add(cat.flag);
      if (LEVEL_RANK.concern > LEVEL_RANK[level]) level = "concern";
    }
  }

  return { level, flags: [...flags] };
}

// Combine the deterministic and AI layers: max of levels, union of flags.
export function mergeRisk(a: RiskSignal | undefined, b: RiskSignal | undefined): RiskSignal {
  const left = a ?? NO_RISK;
  const right = b ?? NO_RISK;
  const level = LEVEL_RANK[left.level] >= LEVEL_RANK[right.level] ? left.level : right.level;
  const flags = [...new Set<RiskFlag>([...left.flags, ...right.flags])];
  return { level, flags };
}

// Coerce untrusted (model-emitted) values into the enum — anything unknown is
// dropped; an unknown level with known flags degrades to "concern" (fail-safe).
export function sanitizeRisk(raw: unknown): RiskSignal | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const flags = Array.isArray(r.flags)
    ? (r.flags.filter((f): f is RiskFlag => RISK_FLAGS.includes(f as RiskFlag)))
    : [];
  const level: RiskLevel =
    r.level === "crisis" || r.level === "concern" || r.level === "none"
      ? r.level
      : flags.length > 0
        ? "concern"
        : "none";
  if (level === "none" && flags.length === 0) return undefined;
  return { level, flags: [...new Set(flags)] };
}

// Zero-retention helper: remove the transient risk signal before an analysis
// result is persisted anywhere (POST body, localStorage vault/demo state, the
// pending-entry stash that survives the OAuth round-trip).
export function stripRisk<T extends { risk?: unknown }>(analysis: T): Omit<T, "risk"> {
  const { risk: _risk, ...rest } = analysis;
  return rest;
}

// ── Support resources (static — never model-generated) ───────────────────────

export interface CrisisResource {
  label: string;
  detail?: string;
  href: string; // tel: / sms: / https:
  kind: "call" | "text" | "link";
}

// 988 serves both the US and Canada (call + text). Timezones give a cheap,
// privacy-free region hint; when in doubt we still show 988 with an explicit
// "(US & Canada)" label plus the universal directory, so nobody gets nothing.
const CA_US_TZ_RE =
  /^(?:America\/(?:New_York|Detroit|Toronto|Montreal|Chicago|Winnipeg|Denver|Edmonton|Boise|Phoenix|Los_Angeles|Vancouver|Anchorage|Juneau|Halifax|Moncton|St_Johns|Regina|Whitehorse|Yellowknife|Iqaluit|Indiana\/\w+|Kentucky\/\w+|North_Dakota\/\w+)|Pacific\/Honolulu|US\/\w+|Canada\/\w+)$/;

const R_988_CALL: CrisisResource = {
  label: "Call or text 988",
  detail: "Suicide & Crisis Helpline — free, 24/7 (US & Canada)",
  href: "tel:988",
  kind: "call",
};

const R_DV: CrisisResource = {
  label: "Domestic violence support",
  detail: "thehotline.org (US) · sheltersafe.ca (Canada)",
  href: "https://www.thehotline.org",
  kind: "link",
};

const R_DIRECTORY: CrisisResource = {
  label: "Find a helpline anywhere",
  detail: "findahelpline.com — free support lines worldwide",
  href: "https://findahelpline.com",
  kind: "link",
};

export function resolveResources(flags: RiskFlag[], timezone?: string): CrisisResource[] {
  const inNA = !timezone || CA_US_TZ_RE.test(timezone); // unknown region → still show 988, clearly labelled
  const out: CrisisResource[] = [];

  // 988 covers self-harm, violence-toward-others, and acute distress lines.
  if (inNA && (flags.length === 0 || flags.some((f) => f !== "abuse"))) out.push(R_988_CALL);
  if (flags.includes("abuse") && inNA) out.push(R_DV);

  // Universal fallback — always present, for every region and every category.
  out.push(R_DIRECTORY);
  return out;
}
