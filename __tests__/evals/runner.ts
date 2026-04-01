// Eval runner — uses extract_v3 ground truth dataset
//
// Run mini (20 tasks):   npx tsx __tests__/evals/runner.ts
// Run full (128 tasks):  npx tsx __tests__/evals/runner.ts --full
// Run specific tags:     npx tsx __tests__/evals/runner.ts --tags company-enrichment
// With model override:   npx tsx __tests__/evals/runner.ts --model google:gemini-2.5-flash
// Single task by index:  npx tsx __tests__/evals/runner.ts --task 5
// Max workers:           npx tsx __tests__/evals/runner.ts --workers 4

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.join(__dirname, "..", "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}
const BASE_URL = process.env.EVAL_BASE_URL ?? "http://localhost:3002";
const DATASET_DIR = path.join(__dirname, "..", "extract_v3_evals", "data", "extract");

// Reuse the json_judge from extract_v3_evals (lazy-loaded to avoid top-level await)
let _scoreJsonPrediction: any;
async function getJudge() {
  if (!_scoreJsonPrediction) {
    const mod = await import("../extract_v3_evals/dist/evals/utils/json_judge.js");
    _scoreJsonPrediction = mod.scoreJsonPrediction;
  }
  return _scoreJsonPrediction;
}

interface ModelOverride {
  provider: string;
  model: string;
}

interface DatasetTask {
  url: string | null;
  prompt: string;
  schema: Record<string, unknown>;
  ground_truth: Record<string, unknown>;
  tags?: string[];
  lang?: string;
  notes?: string;
}

interface RunResult {
  text: string;
  data?: string;
  format?: string;
  steps: unknown[];
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  error?: string;
}

interface TaskResult {
  index: number;
  prompt: string;
  tags: string[];
  score: number;
  precision: number;
  recall: number;
  explanation: string;
  durationMs: number;
  tokens: number;
  error?: string;
}

function parseArgs(argv: string[]) {
  const args = {
    full: false,
    tags: null as string[] | null,
    excludeTags: ["raw-extraction", "documentation", "code"] as string[],
    model: null as ModelOverride | null,
    taskIndex: null as number | null,
    workers: 2,
    lang: null as string | null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--full") args.full = true;
    else if (arg === "--tags" && argv[i + 1]) { args.tags = argv[++i].split(","); }
    else if (arg === "--exclude-tags" && argv[i + 1]) { args.excludeTags = argv[++i].split(","); }
    else if (arg === "--lang" && argv[i + 1]) { args.lang = argv[++i]; }
    else if (arg === "--task" && argv[i + 1]) { args.taskIndex = parseInt(argv[++i]); }
    else if (arg === "--workers" && argv[i + 1]) { args.workers = parseInt(argv[++i]); }
    else if (arg === "--model" && argv[i + 1]) {
      const raw = argv[++i];
      const [provider, ...rest] = raw.split(":");
      args.model = { provider, model: rest.join(":") };
    }
  }
  return args;
}

function loadDataset(full: boolean): DatasetTask[] {
  const file = full ? "ground_truth.jsonl" : "ground_truth_mini.jsonl";
  const filePath = path.join(DATASET_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`Dataset not found: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function filterTasks(tasks: DatasetTask[], args: ReturnType<typeof parseArgs>): DatasetTask[] {
  let filtered = tasks;

  if (args.taskIndex !== null) {
    if (args.taskIndex < 0 || args.taskIndex >= tasks.length) {
      console.error(`Task index ${args.taskIndex} out of range (0-${tasks.length - 1})`);
      process.exit(1);
    }
    return [tasks[args.taskIndex]];
  }

  if (args.tags) {
    filtered = filtered.filter((t) => t.tags?.some((tag) => args.tags!.includes(tag)));
  }

  if (args.excludeTags.length > 0) {
    filtered = filtered.filter((t) => !t.tags?.some((tag) => args.excludeTags.includes(tag)));
  }

  if (args.lang) {
    const langs = args.lang.split(",");
    filtered = filtered.filter((t) => langs.includes(t.lang ?? "english"));
  }

  return filtered;
}

async function runTask(task: DatasetTask, index: number, model: ModelOverride | null): Promise<TaskResult> {
  const startTime = Date.now();
  const tags = task.tags ?? [];

  try {
    const body: Record<string, unknown> = {
      prompt: task.prompt,
      schema: task.schema,
      format: "json",
      maxSteps: 20,
    };
    if (task.url) body.urls = [task.url];
    if (model) {
      body.model = model;
      body.subAgentModel = model;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000); // 3 min timeout
    const resp = await fetch(`${BASE_URL}/api/v1/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${errBody.slice(0, 200)}`);
    }

    const result: RunResult = await resp.json();
    if (result.error) throw new Error(result.error);

    const durationMs = Date.now() - startTime;
    const tokens = result.usage?.totalTokens ?? 0;

    // Parse prediction
    let prediction: Record<string, unknown> = {};
    if (result.data) {
      try { prediction = JSON.parse(result.data); } catch { prediction = {}; }
    }

    // Score with LLM judge
    const judge = await (await getJudge())({
      schema: task.schema,
      ground_truth: task.ground_truth,
      prediction,
    });

    return {
      index,
      prompt: task.prompt.slice(0, 80),
      tags,
      score: judge.score,
      precision: judge.precision,
      recall: judge.recall,
      explanation: judge.explanation,
      durationMs,
      tokens,
    };
  } catch (err) {
    return {
      index,
      prompt: task.prompt.slice(0, 80),
      tags,
      score: 0,
      precision: 0,
      recall: 0,
      explanation: `Error: ${err instanceof Error ? err.message : String(err)}`.slice(0, 200),
      durationMs: Date.now() - startTime,
      tokens: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runBatch(tasks: DatasetTask[], model: ModelOverride | null, concurrency: number): Promise<TaskResult[]> {
  const results: TaskResult[] = [];
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < tasks.length) {
      const i = nextIdx++;
      const task = tasks[i];
      const label = `[${i + 1}/${tasks.length}]`;
      console.log(`  ${label} ${task.tags?.join(",") ?? "?"} | ${task.prompt.slice(0, 60)}...`);
      const result = await runTask(task, i, model);
      const status = result.error ? "\x1b[31m✗\x1b[0m" : result.score >= 0.7 ? "\x1b[32m✓\x1b[0m" : "\x1b[33m~\x1b[0m";
      console.log(`  ${label} ${status} F1=${result.score.toFixed(2)} P=${result.precision.toFixed(2)} R=${result.recall.toFixed(2)} ${(result.durationMs / 1000).toFixed(1)}s`);
      results.push(result);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);

  return results.sort((a, b) => a.index - b.index);
}

async function main() {
  console.log("\n\x1b[1mFirecrawl Agent Eval Suite (extract_v3 ground truth)\x1b[0m");
  console.log(`  Server: ${BASE_URL}`);

  // Verify server
  try { await fetch(`${BASE_URL}/api/config`); }
  catch { console.error(`\n  Cannot reach ${BASE_URL}. Start the dev server first.\n`); process.exit(1); }

  const args = parseArgs(process.argv.slice(2));
  const allTasks = loadDataset(args.full);
  const tasks = filterTasks(allTasks, args);

  const modelLabel = args.model ? `${args.model.provider}:${args.model.model}` : "default";
  console.log(`  Model: ${modelLabel}`);
  console.log(`  Dataset: ${args.full ? "full" : "mini"} (${allTasks.length} total, ${tasks.length} after filtering)`);
  if (args.tags) console.log(`  Tags: ${args.tags.join(", ")}`);
  if (args.excludeTags.length) console.log(`  Excluding: ${args.excludeTags.join(", ")}`);
  console.log(`  Concurrency: ${args.workers}`);
  console.log("");

  const results = await runBatch(tasks, args.model, args.workers);

  // Aggregate
  const scores = results.filter((r) => !r.error);
  const errors = results.filter((r) => r.error);
  const avgF1 = scores.length ? scores.reduce((a, r) => a + r.score, 0) / scores.length : 0;
  const avgP = scores.length ? scores.reduce((a, r) => a + r.precision, 0) / scores.length : 0;
  const avgR = scores.length ? scores.reduce((a, r) => a + r.recall, 0) / scores.length : 0;
  const totalTime = results.reduce((a, r) => a + r.durationMs, 0);
  const totalTokens = results.reduce((a, r) => a + r.tokens, 0);

  // Per-tag breakdown
  const tagStats: Record<string, { count: number; f1Sum: number }> = {};
  for (const r of scores) {
    for (const tag of r.tags) {
      if (!tagStats[tag]) tagStats[tag] = { count: 0, f1Sum: 0 };
      tagStats[tag].count++;
      tagStats[tag].f1Sum += r.score;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`  \x1b[1mResults: ${scores.length} scored, ${errors.length} errors\x1b[0m`);
  console.log(`  F1: ${avgF1.toFixed(3)}  Precision: ${avgP.toFixed(3)}  Recall: ${avgR.toFixed(3)}`);
  console.log(`  Time: ${(totalTime / 1000).toFixed(1)}s  Tokens: ${totalTokens.toLocaleString()}`);

  if (Object.keys(tagStats).length > 1) {
    console.log("\n  Per-tag F1:");
    for (const [tag, s] of Object.entries(tagStats).sort((a, b) => b[1].count - a[1].count)) {
      console.log(`    ${tag.padEnd(22)} ${(s.f1Sum / s.count).toFixed(3)} (n=${s.count})`);
    }
  }

  if (errors.length > 0) {
    console.log("\n  Errors:");
    for (const e of errors) {
      console.log(`    [${e.index}] ${e.explanation.slice(0, 100)}`);
    }
  }

  console.log("=".repeat(60) + "\n");

  // Save results
  const resultsDir = path.join(__dirname, "results");
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(resultsDir, `${ts}_${args.full ? "full" : "mini"}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    model: modelLabel,
    dataset: args.full ? "full" : "mini",
    tasks: tasks.length,
    avgF1, avgP, avgR,
    totalTimeMs: totalTime,
    totalTokens,
    tagStats,
    results,
  }, null, 2));
  console.log(`  Results saved: ${outFile}\n`);

  process.exitCode = avgF1 < 0.5 ? 1 : 0;
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
