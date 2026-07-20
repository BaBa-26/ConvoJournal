import * as chrono from "chrono-node";
import type { AnalysisResult, ExtractedTask, ExtractedReminder } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Local fallback analyzer (v2) — fires only when analyzeWithGemini() throws.
// Zero external dependencies beyond chrono-node (dates), by design: this must
// work when every AI API is down. Returns the same AnalysisResult shape the
// Gemini path returns; `mood` is populated from a local weighted lexicon so the
// fallback keeps mood parity without any schema change. Goals are intentionally
// NOT extracted locally — goal creation/increments need semantic matching that
// regex can't do safely, and false goals are worse than none.
// ─────────────────────────────────────────────────────────────────────────────

// ── Sentence + negation helpers ───────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?\n]+[.!?\n]*/g) ?? [text])
    .map((s) => s.trim())
    .filter(Boolean);
}

// Negators that flip/void a nearby trigger or sentiment word.
const NEGATOR_RE = /\b(?:don'?t|do\s+not|didn'?t|did\s+not|never|not|no|won'?t|will\s+not|wouldn'?t|can'?t|cannot|couldn'?t|shouldn'?t|isn'?t|wasn'?t)\b/i;

/** True when a negator appears in the last few words before `index` in `text`. */
function negatedBefore(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 28), index);
  const lastWords = window.split(/\s+/).slice(-4).join(" ");
  return NEGATOR_RE.test(lastWords);
}

// ── Tense bucketing ───────────────────────────────────────────────────────────

const YESTERDAY_KW = /\b(yesterday|last night|last week|last month|earlier this week|the other day|this morning i (?:was|had|did|went|felt))\b/i;
const TODAY_KW     = /\b(today|this morning|this afternoon|this evening|right now|currently|at the moment|tonight)\b/i;
const TOMORROW_KW  = /\b(tomorrow|next week|next month|next \w+day|upcoming|soon|later this week|this weekend|later today)\b/i;

// Verb-level cues used when no explicit time keyword is present.
const PAST_VERB_RE   = /\b(went|did|was|were|had|got|finished|wrapped|shipped|fixed|cleaned|made|met|saw|felt|worked|spent|managed|forgot|missed|skipped|slept|woke)\b/i;
const FUTURE_CUE_RE  = /\b(will|i'?ll|gonna|going to|need to|have to|gotta|should|want to|plan(?:ning)? to|hope to|hoping to)\b/i;

type Tense = "past" | "present" | "future";

function classifySentence(s: string): Tense {
  // Explicit keywords win; verb heuristics break ties for keyword-less sentences.
  if (YESTERDAY_KW.test(s)) return "past";
  if (TOMORROW_KW.test(s)) return "future";
  if (TODAY_KW.test(s)) return "present";
  if (FUTURE_CUE_RE.test(s)) return "future";
  if (PAST_VERB_RE.test(s)) return "past";
  return "present";
}

function splitSections(sentences: string[]): { yesterday: string; today: string; tomorrow: string } {
  const buckets: Record<Tense, string[]> = { past: [], present: [], future: [] };
  for (const s of sentences) buckets[classifySentence(s)].push(s);
  return {
    yesterday: buckets.past.join(" ").trim(),
    today:     buckets.present.join(" ").trim(),
    tomorrow:  buckets.future.join(" ").trim(),
  };
}

// ── Task extraction ───────────────────────────────────────────────────────────

// Family 1: intention verbs. Negation-guarded ("don't need to call" → no task).
// Lookbehinds exclude past intentions ("was going to", "should have"). The capture
// runs to the END of the sentence (not the first comma) so run-on voice lists like
// "review PRs, update the doc, and email Sam" arrive whole and get split below.
const INTENT_TRIGGERS =
  /\b(?:need to|needs to|gotta|got to|have to|has to|must|should(?!\s+have\b|'ve)|want to|(?<!was\s)(?<!were\s)going to|planning to|plan to|i'?ll|i will|hoping to|hope to|i'?d (?:like|love) to|maybe i should)\s+(.+?)(?=[.!?\n]|\band then\b|$)/gi;

// Family 2: reminder-style imperatives. These embed their own negation
// ("don't forget") so the negation guard must NOT apply to them.
const REMEMBER_TRIGGERS =
  /\b(?:don'?t forget(?: to)?|do not forget(?: to)?|remember to|make sure (?:to|i|we))\s+(.+?)(?=[.!?\n]|$)/gi;

// Hedge phrasing that marks a captured task as aspirational → low priority.
const HEDGE_RE  = /\b(maybe|eventually|someday|at some point|would love|i'?d love|hope to|hoping to)\b/i;
const URGENT_RE = /\b(urgent(?:ly)?|asap|immediately|critical|by (?:tonight|today|tomorrow|end of day|eod)|deadline)\b/i;

// Trailing filler that creeps into voice-transcript captures.
const TRAILING_FILLER_RE = /\s+(?:as well|too|though|or something|i guess|probably|at some point)\s*$/i;

function cleanTitle(raw: string): string | null {
  let t = raw.replace(/\s+/g, " ").replace(TRAILING_FILLER_RE, "").trim();
  t = t.replace(/^(?:to|and|also|then|just)\s+/i, "");
  if (t.length < 3 || t.length > 120) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Action verbs a list segment must start with to count as its own task. Guards the
// splitter against clause-splitting narrative ("call mom, and today was nice" —
// "today was nice" starts with no action verb → dropped, "call mom" kept).
const SEGMENT_VERB_RE =
  /^(?:review|update|email|call|text|message|send|write|draft|book|schedule|finish|figure|clean|buy|get|pick|pay|fix|plan|prepare|check|read|do|make|start|submit|follow|reach|order|renew|cancel|organize|research|look|run|set|back|deal|learn|practice|study|apply|sign|file|print|return|walk|cook|meal|water|take)\b/i;

// Split "review PRs, update the doc, and email Sam" into separate tasks. The first
// segment inherits trust from the trigger phrase; every later segment must start
// with an action verb so compound objects and trailing clauses don't become tasks.
function splitList(phrase: string): string[] {
  const rough = phrase
    .split(/\s*,\s*(?:and\s+|then\s+)?|\s+and then\s+/i)
    .flatMap((seg) => {
      const halves = seg.split(/\s+and\s+/i);
      return halves.length === 2 && halves[0].split(" ").length >= 2 && halves[1].split(" ").length >= 3
        ? halves
        : [seg];
    })
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);

  if (rough.length <= 1) return rough.length ? rough : [phrase];
  return rough.filter((seg, i) => i === 0 || SEGMENT_VERB_RE.test(seg));
}

function extractTasks(text: string, now: Date): ExtractedTask[] {
  const tasks: ExtractedTask[] = [];
  const seen = new Set<string>();

  const families: { re: RegExp; negationGuard: boolean }[] = [
    { re: INTENT_TRIGGERS, negationGuard: true },
    { re: REMEMBER_TRIGGERS, negationGuard: false },
  ];

  for (const { re, negationGuard } of families) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const captured = match[1]?.trim();
      if (!captured) continue;

      // "I don't need to call the bank anymore" → not a task.
      if (negationGuard && negatedBefore(text, match.index)) continue;

      // Date/priority context = the sentence containing the trigger, so a date in a
      // neighbouring sentence ("Today was fine. I have to...") can't bleed into dueDate.
      const sentStart = Math.max(text.lastIndexOf(".", match.index), text.lastIndexOf("!", match.index), text.lastIndexOf("?", match.index), text.lastIndexOf("\n", match.index)) + 1;
      const sentEndRel = text.slice(match.index).search(/[.!?\n]/);
      const sentEnd = sentEndRel === -1 ? text.length : match.index + sentEndRel;
      const context = text.slice(sentStart, sentEnd);

      for (const piece of splitList(captured)) {
        const title = cleanTitle(piece);
        if (!title || seen.has(title.toLowerCase())) continue;
        seen.add(title.toLowerCase());

        const parsed = chrono.parseDate(piece, now, { forwardDate: true })
          ?? chrono.parseDate(context, now, { forwardDate: true });

        let priority: "high" | "medium" | "low" = "medium";
        if (URGENT_RE.test(context)) priority = "high";
        else if (HEDGE_RE.test(context)) priority = "low";

        tasks.push({ title, dueDate: parsed ? parsed.toISOString() : undefined, priority });
        if (tasks.length >= 20) return tasks;
      }
    }
  }

  return tasks;
}

// ── Reminder extraction ───────────────────────────────────────────────────────

// "call" is only an event when used as a NOUN ("a call", "team call") — bare verb
// use ("I need to call my sister tomorrow") is an intent, which the task extractor
// already handles; matching it here produced duplicate junk reminders.
const EVENT_NOUN_RE =
  /\b(?:meeting|(?:a|the|my|our|this|that|phone|conference|video|team|client)\s+call|appointment|interview|doctor|dentist|lunch|dinner|breakfast|coffee|event|party|wedding|birthday|deadline|due date|flight|trip|session|class|demo|standup|review)\b/i;

// Events described as no longer happening must not become reminders.
const CANCELLED_RE = /\b(cancel(?:l)?ed|reschedul(?:ed|ing)|moved|postponed|skipped|missed|called off)\b/i;

// A sentence that reports something that already happened must never yield a
// reminder, even when it names a clock time ("I had a meeting at 9 this morning").
function isPastEvent(sentence: string): boolean {
  return PAST_VERB_RE.test(sentence) && !FUTURE_CUE_RE.test(sentence) && !TOMORROW_KW.test(sentence);
}

function extractReminders(text: string, sentences: string[], now: Date): ExtractedReminder[] {
  const reminders: ExtractedReminder[] = [];

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Locate each sentence's span so chrono results can be grouped per sentence.
  const spans: { start: number; end: number; sentence: string }[] = [];
  let cursor = 0;
  for (const s of sentences) {
    const idx = text.indexOf(s, cursor);
    if (idx === -1) continue;
    spans.push({ start: idx, end: idx + s.length, sentence: s });
    cursor = idx + s.length;
  }
  const spanAt = (i: number) => spans.find((sp) => i >= sp.start && i < sp.end);

  // Group chrono hits by sentence — one reminder max per sentence. Multiple date
  // fragments in one sentence ("tomorrow ... at 2pm") describe the SAME event, and
  // the fragment with a certain clock time is the most specific one.
  const bySentence = new Map<string, { result: chrono.ParsedResult; sentence: string }>();
  for (const result of chrono.parse(text, now, { forwardDate: true })) {
    const span = spanAt(result.index);
    if (!span) continue;
    const existing = bySentence.get(span.sentence);
    const certain = result.start.isCertain("hour");
    if (!existing || (certain && !existing.result.start.isCertain("hour"))) {
      bySentence.set(span.sentence, { result, sentence: span.sentence });
    }
  }

  for (const { result, sentence } of bySentence.values()) {
    const eventDate = result.date();
    if (!eventDate) continue;

    // Consistent with the Gemini path: drop anything before today.
    if (eventDate.getTime() < startOfToday.getTime()) continue;
    if (isPastEvent(sentence)) continue;
    if (CANCELLED_RE.test(sentence)) continue;

    // Reminder = scheduled EVENT. A date/time with no event noun in its sentence is
    // narrative ("today was fine") or already a task ("I'll do the taxes Sunday") —
    // requiring the noun is what keeps this extractor from spraying junk reminders.
    if (!EVENT_NOUN_RE.test(sentence)) continue;

    let title = sentence
      .replace(result.text, "")
      .replace(/^(?:.*?\b(?:i have|we have|i'?ve got|there'?s|there is)\s+(?:a|an|the)?\s*)/i, "")
      .replace(/^(?:and|so|then|also|at|on|for|my|our)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80)
      .replace(/[,;.\s]+$/, "");
    if (!title || title.length < 3) continue;
    title = title.charAt(0).toUpperCase() + title.slice(1);

    reminders.push({ title, eventDate: eventDate.toISOString() });
    if (reminders.length >= 20) break;
  }

  return reminders;
}

// ── Mood detection (weighted lexicon + negation flip) ────────────────────────

// word → { v: valence weight, e: emotion label }. Only *specific* emotion words
// vote for a label; generic good/bad words contribute valence (threshold) only.
const MOOD_LEXICON: Record<string, { v: number; e: string | null }> = {
  // positive, specific
  happy: { v: 2, e: "happy" },        glad: { v: 1, e: "happy" },
  grateful: { v: 2, e: "grateful" },  thankful: { v: 2, e: "grateful" },
  excited: { v: 2, e: "excited" },    pumped: { v: 2, e: "excited" },
  calm: { v: 1, e: "calm" },          peaceful: { v: 2, e: "calm" },
  relaxed: { v: 1, e: "calm" },       relieved: { v: 1, e: "relieved" },
  focused: { v: 1, e: "focused" },    productive: { v: 2, e: "focused" },
  motivated: { v: 2, e: "motivated" }, proud: { v: 2, e: "proud" },
  hopeful: { v: 1, e: "hopeful" },    optimistic: { v: 2, e: "hopeful" },
  energized: { v: 2, e: "energized" },
  // positive, generic (valence only)
  good: { v: 1, e: null }, great: { v: 1, e: null }, amazing: { v: 2, e: null }, solid: { v: 1, e: null },
  // negative, specific
  stressed: { v: -2, e: "stressed" },   stressful: { v: -2, e: "stressed" },
  anxious: { v: -2, e: "anxious" },     anxiety: { v: -2, e: "anxious" },
  worried: { v: -1, e: "anxious" },     overwhelmed: { v: -2, e: "overwhelmed" },
  tired: { v: -1, e: "tired" },         exhausted: { v: -2, e: "tired" },
  drained: { v: -2, e: "tired" },       frustrated: { v: -2, e: "frustrated" },
  frustrating: { v: -2, e: "frustrated" }, annoyed: { v: -1, e: "frustrated" },
  angry: { v: -2, e: "angry" },         mad: { v: -1, e: "angry" },
  sad: { v: -2, e: "sad" },             upset: { v: -1, e: "sad" },
  lonely: { v: -2, e: "lonely" },       scattered: { v: -1, e: "scattered" },
  // negative, generic (valence only)
  bad: { v: -1, e: null }, awful: { v: -2, e: null }, terrible: { v: -2, e: null }, rough: { v: -1, e: null },
};

export function detectMood(text: string): string | undefined {
  const words = text.toLowerCase().split(/[^a-z']+/);
  const votes = new Map<string, number>();
  let valence = 0;

  for (let i = 0; i < words.length; i++) {
    const hit = MOOD_LEXICON[words[i]];
    if (!hit) continue;

    // "not happy" / "wasn't calm": flip valence; a negated positive votes "low"
    // instead of its own emotion; a negated negative just stops voting.
    const prev = words.slice(Math.max(0, i - 2), i).join(" ");
    const negated = NEGATOR_RE.test(prev);

    if (negated) {
      valence -= hit.v;
      if (hit.v > 0) votes.set("low", (votes.get("low") ?? 0) + 1);
      continue;
    }

    valence += hit.v;
    if (hit.e) votes.set(hit.e, (votes.get(hit.e) ?? 0) + Math.abs(hit.v));
  }

  if (votes.size === 0) return undefined; // generic-only hits → no confident label
  let best: string | undefined;
  let bestScore = 0;
  for (const [emotion, score] of votes) {
    if (score > bestScore) { best = emotion; bestScore = score; }
  }
  // Require a minimum signal so one weak word doesn't label the whole day.
  return bestScore >= 1 && Math.abs(valence) >= 1 ? best : undefined;
}

// ── Entry point ───────────────────────────────────────────────────────────────

// `now` is the reference instant chrono resolves relative dates against. The caller
// (app/api/analyze) passes a timezone-corrected reference (local noon of the user's
// calendar day) so a fallback "tomorrow" at 11pm doesn't land on the wrong day the way
// a UTC `new Date()` does on Vercel. Defaults to `new Date()` for direct/local callers.
export function parseJournalEntry(text: string, now: Date = new Date()): AnalysisResult {
  const sentences = splitSentences(text);
  const sections = splitSections(sentences);
  const tasks = extractTasks(text, now);
  const reminders = extractReminders(text, sentences, now);
  const mood = detectMood(text);

  return {
    yesterday: sections.yesterday || undefined,
    today: sections.today || undefined,
    tomorrow: sections.tomorrow || undefined,
    mood,
    tasks,
    reminders,
    source: "fallback",
  };
}
