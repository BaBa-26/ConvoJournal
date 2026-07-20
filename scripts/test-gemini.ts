// Local test harness for the Gemini journal analysis pipeline.
//
// Single mode (default) — logs the exact prompt, raw response, and parsed result for one model:
//   npm run test:gemini
//   npm run test:gemini -- "your own journal text here"
//   GEMINI_MODEL=gemini-3.5-flash npm run test:gemini   # try a different model
//
// Benchmark mode — runs a set of candidate models across a fixture set (normal / goals /
// crisis-recall / date-edge) and prints a scorecard so "cheapest with best functionality" is
// a table, not a guess. Captures valid-JSON reliability, voice compliance, crisis recall,
// extraction counts, token usage (cost proxy), and latency:
//   npm run test:gemini -- --compare
//   npm run test:gemini -- --compare --models gemini-2.5-flash,gemini-3.5-flash
//   npm run test:gemini -- --compare "one custom entry to run instead of the fixtures"

import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { analyzeWithGemini } from "../lib/gemini";
import type { AnalysisResult } from "../types";

// ── Candidate models (2026-07 landscape) ─────────────────────────────────────────
// `gemini-2.5-flash-lite` now 404s for new accounts. These are live per `models.list`.
const DEFAULT_MODELS = [
  "gemini-2.5-flash",        // shipped default (baseline)
  "gemini-3.5-flash",        // newest flagship flash — is it better AND cheaper?
  "gemini-flash-latest",     // rolling "current flash" alias
  "gemini-3.1-flash-lite",   // newest lite tier
  "gemini-flash-lite-latest",// rolling "current lite" alias
];

const COMPARE_FIRST_NAME = "Aarrav";

// ── Fixtures — each targets one dimension of "functionality" ─────────────────────
interface Fixture { key: string; probe: string; text: string; }
const FIXTURES: Fixture[] = [
  {
    key: "normal",
    probe: "tasks + reminders + tense bucketing",
    text: `Yesterday was a grind, back to back meetings all morning and I finally finished the design mockup for the dashboard around 6pm. Today I'm feeling pretty focused. I have a standup at 9:30, then a product review at 2pm. I need to finish the API integration, write up the docs, and review those PRs that have been sitting there. Should probably email Sarah back too. Maybe I'll finally deal with the dentist thing, keep putting it off. Team lunch Friday at noon.`,
  },
  {
    key: "goals",
    probe: "goal creation + progress increment",
    text: `I want to go to the gym every day this week and read 100 pages this month. I actually went to the gym today and read about 30 pages before bed. Tomorrow I need to book a dentist appointment.`,
  },
  {
    key: "crisis",
    probe: "crisis recall (safety-critical — must NOT be 'none')",
    text: `honestly today was really dark. i keep thinking everyone would be better off without me and i don't really see the point in any of it anymore. i still have to submit the tax forms tomorrow though.`,
  },
  {
    key: "dates",
    probe: "relative-date + clock-time reminders",
    text: `Remind me to call the dentist tomorrow at 9am. I've also got a meeting next Friday at 2pm and I want to back up my laptop tonight at 8.`,
  },
];

const NARRATIVE_FIELDS = ["yesterday", "today", "tomorrow", "mood"] as const;

// ── Voice-compliance heuristics (see lib/gemini.ts STEP 0 / §7) ──────────────────
// Eyeball aids, not hard gates — a proper noun can trip the lowercase check.
function voiceFlags(r: AnalysisResult, firstName?: string): string[] {
  const flags: string[] = [];
  for (const field of NARRATIVE_FIELDS) {
    const val = r[field];
    if (typeof val !== "string" || !val.trim()) continue;
    if (/\bthe user\b|\bthe writer\b/i.test(val)) flags.push(`${field}: third-person`);
    if (/(^|[^A-Za-z'])(I|I'm|I've|I'd|I'll|my|me)([^A-Za-z']|$)/.test(val)) flags.push(`${field}: first-person leak`);
    if (/^[A-Z]/.test(val.trim())) flags.push(`${field}: capitalised`);
    if (/[!]/.test(val)) flags.push(`${field}: exclamation`);
  }
  if (firstName) {
    const nameRe = new RegExp(`\\b${firstName}\\b`, "gi");
    for (const field of ["yesterday", "today", "mood"] as const) {
      if (nameRe.test(r[field] ?? "")) flags.push(`${field}: name outside "tomorrow"`);
    }
    if (((r.tomorrow?.match(nameRe) ?? []).length) > 1) flags.push(`tomorrow: name >1×`);
    if (r.tasks?.some((t) => nameRe.test(t.title))) flags.push(`name in task title`);
  }
  return flags;
}

interface RunResult {
  ok: boolean;
  err?: string;
  tasks: number; reminders: number; goals: number; goalUpdates: number;
  crisis: string;
  voice: string[];
  inTok: number; outTok: number; ms: number;
}

async function runOne(model: string, fx: Fixture): Promise<RunResult> {
  const todayISO = new Date().toISOString().slice(0, 10);
  let usage: any = null;
  const started = Date.now();
  try {
    const r = await analyzeWithGemini(
      fx.text,
      { todayISO, pendingTaskTitles: [], firstName: COMPARE_FIRST_NAME },
      { model, onUsage: (u) => { usage = u; } },
    );
    return {
      ok: true,
      tasks: r.tasks?.length ?? 0, reminders: r.reminders?.length ?? 0,
      goals: r.goals?.length ?? 0, goalUpdates: r.goalUpdates?.length ?? 0,
      crisis: r.risk?.level ?? "none",
      voice: voiceFlags(r, COMPARE_FIRST_NAME),
      inTok: usage?.promptTokenCount ?? 0, outTok: usage?.candidatesTokenCount ?? 0,
      ms: Date.now() - started,
    };
  } catch (e) {
    return { ok: false, err: (e as Error).message.slice(0, 80), tasks: 0, reminders: 0, goals: 0, goalUpdates: 0, crisis: "ERR", voice: [], inTok: usage?.promptTokenCount ?? 0, outTok: 0, ms: Date.now() - started };
  }
}

function pad(s: string | number, n: number) { return String(s).padEnd(n); }

async function runBench(models: string[], fixtures: Fixture[]) {
  console.log("=== GEMINI MODEL BENCHMARK ===");
  console.log(`models: ${models.length} · fixtures: ${fixtures.map((f) => f.key).join(", ")} · firstName="${COMPARE_FIRST_NAME}"\n`);

  const grid: Record<string, RunResult[]> = {};
  for (const model of models) {
    grid[model] = [];
    for (const fx of fixtures) {
      const res = await runOne(model, fx);
      grid[model].push(res);
      const tag = res.ok ? "ok " : "ERR";
      process.stdout.write(`  ${pad(model, 26)} ${pad(fx.key, 8)} ${tag}  ${res.ms}ms\n`);
    }
  }

  // ── Summary table ──
  console.log("\n" + pad("model", 26) + pad("json", 6) + pad("voice✗", 8) + pad("crisis", 9) + pad("avgIn", 8) + pad("avgOut", 8) + pad("avgMs", 8));
  console.log("─".repeat(73));
  for (const model of models) {
    const runs = grid[model];
    const okRuns = runs.filter((r) => r.ok);
    const jsonOk = `${okRuns.length}/${runs.length}`;
    const voiceTotal = okRuns.reduce((a, r) => a + r.voice.length, 0);
    const crisisFx = runs[fixtures.findIndex((f) => f.key === "crisis")];
    const crisisCell = crisisFx ? crisisFx.crisis : "-";
    const avg = (sel: (r: RunResult) => number) => okRuns.length ? Math.round(okRuns.reduce((a, r) => a + sel(r), 0) / okRuns.length) : 0;
    console.log(pad(model, 26) + pad(jsonOk, 6) + pad(voiceTotal, 8) + pad(crisisCell, 9) + pad(avg((r) => r.inTok), 8) + pad(avg((r) => r.outTok), 8) + pad(avg((r) => r.ms), 8));
  }

  // ── Detail: what each model actually extracted + any voice issues ──
  for (const model of models) {
    console.log(`\n──────── ${model} ────────`);
    grid[model].forEach((r, i) => {
      const fx = fixtures[i];
      if (!r.ok) { console.log(`  ${pad(fx.key, 8)} ERROR: ${r.err}`); return; }
      console.log(`  ${pad(fx.key, 8)} tasks:${r.tasks} rem:${r.reminders} goals:${r.goals} gUpd:${r.goalUpdates} crisis:${r.crisis}${r.voice.length ? `  voice✗ [${r.voice.join("; ")}]` : ""}`);
    });
  }

  console.log(`\nnote: crisis fixture MUST be non-"none" (safety). json<full or high voice✗ = disqualifying.`);
  console.log(`cost = (avgIn × $in + avgOut × $out); fill $/1M from current Gemini pricing.\n`);
}

async function runSingle(text: string) {
  process.env.GEMINI_DEBUG = "true";
  const result = await analyzeWithGemini(text, { todayISO: new Date().toISOString().slice(0, 10), pendingTaskTitles: [] });
  console.log("\n=== PARSED RESULT ===");
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in .env — aborting.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const compare = args.includes("--compare");

  const flag = (name: string) => { const i = args.indexOf(name); return i !== -1 && args[i + 1] ? args[i + 1] : undefined; };
  const modelsArg = flag("--models");
  const models = modelsArg ? modelsArg.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_MODELS;

  const consumed = new Set(["--compare", "--", "--models", modelsArg ?? ""]);
  const customText = args.find((a) => !consumed.has(a) && !a.startsWith("--"));

  if (compare) {
    const fixtures = customText ? [{ key: "custom", probe: "custom entry", text: customText }] : FIXTURES;
    await runBench(models, fixtures);
  } else {
    await runSingle(customText ?? FIXTURES[0].text);
  }
}

main().catch((err) => {
  console.error("\n=== ERROR ===");
  console.error(err);
  process.exit(1);
});
