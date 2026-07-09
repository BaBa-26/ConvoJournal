// Fixture-driven functional check for the v2 regex fallback parser (lib/parser.ts)
// and the deterministic crisis detector (lib/crisis.ts). No test framework — run:
//   npx tsx scripts/parser-check.ts
// Prints pass/fail per fixture and exits non-zero on any failure.

import { parseJournalEntry, detectMood } from "../lib/parser";
import { detectCrisisSignals, mergeRisk, sanitizeRisk } from "../lib/crisis";

type Check = { name: string; run: () => string | null }; // null = pass, string = failure detail

const checks: Check[] = [];
function check(name: string, run: () => string | null) {
  checks.push({ name, run });
}

// Small assertion helpers that return failure strings instead of throwing.
function expect(cond: boolean, detail: string): string | null {
  return cond ? null : detail;
}
function firstFail(...results: (string | null)[]): string | null {
  return results.find((r) => r !== null) ?? null;
}

// ── Tense bucketing ───────────────────────────────────────────────────────────

check("sections: explicit yesterday/today/tomorrow keywords", () => {
  const r = parseJournalEntry(
    "Yesterday was a total grind at work. Today I'm feeling more settled. Tomorrow I'm visiting the museum."
  );
  return firstFail(
    expect(!!r.yesterday?.toLowerCase().includes("grind"), `yesterday bucket missing: ${r.yesterday}`),
    expect(!!r.today?.toLowerCase().includes("settled"), `today bucket missing: ${r.today}`),
    expect(!!r.tomorrow?.toLowerCase().includes("museum"), `tomorrow bucket missing: ${r.tomorrow}`)
  );
});

check("sections: verb-cue fallback (past verbs → yesterday, future cues → tomorrow)", () => {
  const r = parseJournalEntry("Finished the mockup and shipped the login fix. I'll start on the report soon.");
  return firstFail(
    expect(!!r.yesterday?.toLowerCase().includes("mockup"), `past-verb sentence not in yesterday: ${r.yesterday}`),
    expect(!!r.tomorrow?.toLowerCase().includes("report"), `future-cue sentence not in tomorrow: ${r.tomorrow}`)
  );
});

// ── Task family 1: intent triggers ───────────────────────────────────────────

check("tasks: 'need to' produces a task", () => {
  const r = parseJournalEntry("I need to call the bank.");
  return expect(
    r.tasks.length === 1 && r.tasks[0].title.toLowerCase().includes("call the bank"),
    `expected 1 'call the bank' task, got ${JSON.stringify(r.tasks)}`
  );
});

check("tasks: 'gotta' produces a task", () => {
  const r = parseJournalEntry("Gotta pick up groceries.");
  return expect(
    r.tasks.length === 1 && r.tasks[0].title.toLowerCase().includes("pick up groceries"),
    `expected 1 groceries task, got ${JSON.stringify(r.tasks)}`
  );
});

check("tasks: lookbehind excludes past intention 'was going to'", () => {
  const r = parseJournalEntry("I was going to call the bank.");
  return expect(r.tasks.length === 0, `past intention became a task: ${JSON.stringify(r.tasks)}`);
});

check("tasks: 'should have' is not a task", () => {
  const r = parseJournalEntry("I should have called mom.");
  return expect(r.tasks.length === 0, `'should have' became a task: ${JSON.stringify(r.tasks)}`);
});

check("tasks: negation guard ('don't need to')", () => {
  const r = parseJournalEntry("I don't need to call the bank anymore.");
  return expect(r.tasks.length === 0, `negated intent became a task: ${JSON.stringify(r.tasks)}`);
});

// ── Task family 2: remember triggers (negation guard must NOT apply) ─────────

check("tasks: 'don't forget to' yields a task despite the negator", () => {
  const r = parseJournalEntry("Don't forget to water the plants.");
  return expect(
    r.tasks.length === 1 && r.tasks[0].title.toLowerCase().includes("water the plants"),
    `remember-trigger task missing: ${JSON.stringify(r.tasks)}`
  );
});

// ── List splitting ────────────────────────────────────────────────────────────

check("tasks: run-on list splits into separate tasks", () => {
  const r = parseJournalEntry("I have to review PRs, update the doc, and email Sam.");
  const titles = r.tasks.map((t) => t.title.toLowerCase());
  return firstFail(
    expect(r.tasks.length === 3, `expected 3 tasks, got ${JSON.stringify(titles)}`),
    expect(titles.some((t) => t.includes("review prs")), `missing 'review PRs' in ${JSON.stringify(titles)}`),
    expect(titles.some((t) => t.includes("update the doc")), `missing 'update the doc' in ${JSON.stringify(titles)}`),
    expect(titles.some((t) => t.includes("email sam")), `missing 'email Sam' in ${JSON.stringify(titles)}`)
  );
});

check("tasks: trailing narrative clause without action verb is dropped", () => {
  const r = parseJournalEntry("I need to call mom, and today was nice.");
  const titles = r.tasks.map((t) => t.title.toLowerCase());
  return expect(
    r.tasks.length === 1 && titles[0].includes("call mom"),
    `narrative clause leaked into tasks: ${JSON.stringify(titles)}`
  );
});

// ── Priority ──────────────────────────────────────────────────────────────────

check("priority: urgent language → high", () => {
  const r = parseJournalEntry("I need to submit the report asap.");
  return expect(
    r.tasks.length === 1 && r.tasks[0].priority === "high",
    `expected high priority, got ${JSON.stringify(r.tasks)}`
  );
});

check("priority: hedge language → low", () => {
  const r = parseJournalEntry("Maybe I should deal with the dentist.");
  return expect(
    r.tasks.length === 1 && r.tasks[0].priority === "low",
    `expected low priority, got ${JSON.stringify(r.tasks)}`
  );
});

check("priority: default medium", () => {
  const r = parseJournalEntry("I need to buy groceries.");
  return expect(
    r.tasks.length === 1 && r.tasks[0].priority === "medium",
    `expected medium priority, got ${JSON.stringify(r.tasks)}`
  );
});

// ── Due dates ─────────────────────────────────────────────────────────────────

check("dueDate: date inside the task sentence is parsed", () => {
  const r = parseJournalEntry("I need to submit the report on Friday.");
  return expect(
    r.tasks.length === 1 && typeof r.tasks[0].dueDate === "string",
    `expected a dueDate, got ${JSON.stringify(r.tasks)}`
  );
});

check("dueDate: a date in a NEIGHBOURING sentence must not bleed in", () => {
  const r = parseJournalEntry("Tomorrow is my birthday. I need to clean the garage.");
  const task = r.tasks.find((t) => t.title.toLowerCase().includes("garage"));
  return firstFail(
    expect(!!task, `garage task missing: ${JSON.stringify(r.tasks)}`),
    expect(task?.dueDate === undefined, `neighbour-sentence date bled into dueDate: ${task?.dueDate}`)
  );
});

// ── Reminders ─────────────────────────────────────────────────────────────────

check("reminders: event noun + time → reminder with correct hour", () => {
  const r = parseJournalEntry("I have a dentist appointment tomorrow at 2pm.");
  return firstFail(
    expect(r.reminders.length === 1, `expected 1 reminder, got ${JSON.stringify(r.reminders)}`),
    expect(
      new Date(r.reminders[0]?.eventDate ?? 0).getHours() === 14,
      `expected 14:00 local, got ${r.reminders[0]?.eventDate}`
    )
  );
});

check("reminders: date without an event noun is NOT a reminder", () => {
  const r = parseJournalEntry("Today was fine, honestly.");
  return expect(r.reminders.length === 0, `junk reminder: ${JSON.stringify(r.reminders)}`);
});

check("reminders: past events with a clock time are dropped", () => {
  const r = parseJournalEntry("I had a meeting at 9 this morning.");
  return expect(r.reminders.length === 0, `past event became a reminder: ${JSON.stringify(r.reminders)}`);
});

check("reminders: cancelled events are dropped", () => {
  const r = parseJournalEntry("My dentist appointment tomorrow got cancelled.");
  return expect(r.reminders.length === 0, `cancelled event became a reminder: ${JSON.stringify(r.reminders)}`);
});

check("reminders: verb 'call' is an intent (task), not an event reminder", () => {
  const r = parseJournalEntry("I need to call my sister tomorrow.");
  return firstFail(
    expect(r.reminders.length === 0, `verb-call became a junk reminder: ${JSON.stringify(r.reminders)}`),
    expect(r.tasks.length === 1, `expected the intent as a task: ${JSON.stringify(r.tasks)}`)
  );
});

check("reminders: noun 'call' ('a call with…') IS an event reminder", () => {
  const r = parseJournalEntry("I have a call with the client tomorrow at 2pm.");
  return expect(
    r.reminders.length === 1 && new Date(r.reminders[0].eventDate).getHours() === 14,
    `noun-call reminder missing/wrong: ${JSON.stringify(r.reminders)}`
  );
});

check("reminders: one per sentence — certain clock time wins", () => {
  const r = parseJournalEntry("Tomorrow I have a doctor appointment at 3pm.");
  return firstFail(
    expect(r.reminders.length === 1, `expected exactly 1 reminder, got ${JSON.stringify(r.reminders)}`),
    expect(
      new Date(r.reminders[0]?.eventDate ?? 0).getHours() === 15,
      `certain-hour fragment did not win: ${r.reminders[0]?.eventDate}`
    )
  );
});

// ── Mood ──────────────────────────────────────────────────────────────────────

check("mood: specific emotion words vote", () => {
  const m = detectMood("Today was really productive and I feel focused.");
  return expect(m === "focused", `expected 'focused', got '${m}'`);
});

check("mood: negated positive flips to 'low'", () => {
  const m = detectMood("I'm not happy about how it went.");
  return expect(m === "low", `expected 'low', got '${m}'`);
});

check("mood: generic-only words → undefined (no confident label)", () => {
  const m = detectMood("Today was good.");
  return expect(m === undefined, `generic words produced a label: '${m}'`);
});

// ── Dedup + caps ─────────────────────────────────────────────────────────────

check("tasks: duplicate titles are deduped", () => {
  const r = parseJournalEntry("I need to call mom. I really need to call mom.");
  return expect(r.tasks.length === 1, `duplicates not deduped: ${JSON.stringify(r.tasks)}`);
});

check("tasks: capped at 20", () => {
  const text = Array.from({ length: 30 }, (_, i) => `I need to buy item${i}.`).join(" ");
  const r = parseJournalEntry(text);
  return expect(r.tasks.length === 20, `cap failed: ${r.tasks.length} tasks`);
});

// ── Crisis detector (lib/crisis.ts) ──────────────────────────────────────────

check("crisis: explicit self-harm phrasing → crisis + self_harm", () => {
  const s = detectCrisisSignals("I've been thinking about killing myself lately.");
  return expect(
    s.level === "crisis" && s.flags.includes("self_harm"),
    `got ${JSON.stringify(s)}`
  );
});

check("crisis: negated phrasing demotes to concern — never to none", () => {
  const s = detectCrisisSignals("I would never hurt myself, but today was very dark.");
  return expect(
    s.level === "concern" && s.flags.includes("self_harm"),
    `got ${JSON.stringify(s)}`
  );
});

check("crisis: warning-sign phrasing → concern", () => {
  const s = detectCrisisSignals("What's the point anymore. I feel hopeless about everything.");
  return expect(
    s.level === "concern" && s.flags.includes("self_harm"),
    `got ${JSON.stringify(s)}`
  );
});

check("crisis: abuse disclosure → crisis + abuse", () => {
  const s = detectCrisisSignals("He hit me again last night and I'm scared to go back.");
  return expect(s.level === "crisis" && s.flags.includes("abuse"), `got ${JSON.stringify(s)}`);
});

check("crisis: violent intent → crisis + violence", () => {
  const s = detectCrisisSignals("I want to hurt him for what he did to me.");
  return expect(s.level === "crisis" && s.flags.includes("violence"), `got ${JSON.stringify(s)}`);
});

check("crisis: acute distress → concern + distress", () => {
  const s = detectCrisisSignals("I had a panic attack at work today and couldn't calm down.");
  return expect(s.level === "concern" && s.flags.includes("distress"), `got ${JSON.stringify(s)}`);
});

check("crisis: ordinary bad day → none", () => {
  const s = detectCrisisSignals(
    "Rough day, meetings ran long and I'm exhausted. Gym tomorrow at 7am should help."
  );
  return expect(s.level === "none" && s.flags.length === 0, `false positive: ${JSON.stringify(s)}`);
});

check("crisis: mergeRisk takes max level and unions flags", () => {
  const merged = mergeRisk(
    { level: "concern", flags: ["distress"] },
    { level: "crisis", flags: ["self_harm"] }
  );
  return expect(
    merged.level === "crisis" &&
      merged.flags.includes("self_harm") &&
      merged.flags.includes("distress"),
    `got ${JSON.stringify(merged)}`
  );
});

check("crisis: sanitizeRisk drops unknown values, degrades unknown level to concern", () => {
  const s = sanitizeRisk({ level: "banana", flags: ["self_harm", "fake_flag"] });
  return expect(
    s?.level === "concern" && s.flags.length === 1 && s.flags[0] === "self_harm",
    `got ${JSON.stringify(s)}`
  );
});

check("crisis: sanitizeRisk returns undefined for garbage / empty", () => {
  return firstFail(
    expect(sanitizeRisk("nonsense") === undefined, "string input not rejected"),
    expect(sanitizeRisk({ level: "none", flags: [] }) === undefined, "empty none not collapsed"),
    expect(sanitizeRisk(null) === undefined, "null not rejected")
  );
});

// ── Runner ────────────────────────────────────────────────────────────────────

let failed = 0;
for (const c of checks) {
  let detail: string | null;
  try {
    detail = c.run();
  } catch (err) {
    detail = `threw: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (detail === null) {
    console.log(`  ✓ ${c.name}`);
  } else {
    failed++;
    console.error(`  ✗ ${c.name}\n      ${detail}`);
  }
}

console.log(`\n${checks.length - failed}/${checks.length} fixtures passed`);
if (failed > 0) process.exit(1);
