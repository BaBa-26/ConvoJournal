// Local test harness for the Gemini journal analysis pipeline.
// Logs the exact prompt sent to Gemini, its raw response, and the parsed/validated result.
// Usage: npm run test:gemini  (uses the sample entry below)
//        npm run test:gemini -- "your own journal text here"

import dotenv from "dotenv";
dotenv.config({ path: ".env" });

process.env.GEMINI_DEBUG = "true";

import { analyzeWithGemini } from "../lib/gemini";

const SAMPLE_ENTRY = `
Yesterday was a grind, back to back meetings all morning and I finally finished
the design mockup for the dashboard around 6pm. Today I'm feeling pretty focused.
I have a standup at 9:30, then a product review at 2pm. I need to finish the API
integration, write up the docs, and review those PRs that have been sitting there.
Should probably email Sarah back too. Maybe I'll finally deal with the dentist
thing, keep putting it off. Team lunch Friday at noon. Eventually I really want
to get back into shape.
`.trim();

async function main() {
  const text = process.argv[2] ?? SAMPLE_ENTRY;

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in .env — aborting.");
    process.exit(1);
  }

  const result = await analyzeWithGemini(text, {
    todayISO: new Date().toISOString().slice(0, 10),
    pendingTaskTitles: [],
  });

  console.log("\n=== PARSED RESULT ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("\n=== ERROR ===");
  console.error(err);
  process.exit(1);
});
