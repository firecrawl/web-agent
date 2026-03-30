// End-to-end eval suite — run with: npx tsx __tests__/eval.ts
// Tests API routes, bash tool, formatOutput, and file pipeline
// No LLM calls, no Firecrawl API needed

import { initBashWithFiles, listBashFiles, readBashFile, bashExec } from "../lib/agents/bash-tool";
import { formatOutput } from "../lib/agents/tools";

const ctx = { toolCallId: "t1", messages: [] as never[], abortSignal: new AbortController().signal };
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } catch (e) {
    console.error(`  \x1b[31m✗\x1b[0m ${name}: ${e}`);
    failed++;
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) throw new Error(`${msg ?? "assertEq"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function main() {
  console.log("\n\x1b[1mFirecrawl Agent Eval Suite\x1b[0m\n");

  // ─── Bash Tool ───
  console.log("  \x1b[90m── bash-tool ──\x1b[0m");

  await initBashWithFiles({
    "/data/companies.json": JSON.stringify([
      { name: "Acme", revenue: 1000000, employees: 50 },
      { name: "Globex", revenue: 2500000, employees: 120 },
      { name: "Initech", revenue: 800000, employees: 30 },
    ]),
    "/data/prices.csv": "product,price,currency\nWidget A,29.99,USD\nWidget B,49.99,USD\nWidget C,9.99,USD",
  });

  await test("echo returns stdout", async () => {
    const r = await bashExec.execute!({ command: "echo hello" }, ctx);
    assertEq(r.stdout.trim(), "hello");
    assertEq(r.exitCode, 0);
  });

  await test("cat reads seeded JSON", async () => {
    const r = await bashExec.execute!({ command: "cat /data/companies.json" }, ctx);
    const data = JSON.parse(r.stdout);
    assertEq(data.length, 3);
    assertEq(data[0].name, "Acme");
  });

  await test("cat reads seeded CSV", async () => {
    const r = await bashExec.execute!({ command: "cat /data/prices.csv" }, ctx);
    assert(r.stdout.includes("Widget A,29.99"), "missing Widget A");
  });

  await test("jq processes JSON", async () => {
    const r = await bashExec.execute!({ command: 'cat /data/companies.json | jq ".[].name"' }, ctx);
    assert(r.stdout.includes('"Acme"'), "missing Acme");
    assert(r.stdout.includes('"Globex"'), "missing Globex");
  });

  await test("awk processes CSV", async () => {
    const r = await bashExec.execute!({ command: "awk -F, 'NR>1{sum+=$2}END{print sum}' /data/prices.csv" }, ctx);
    assertEq(r.stdout.trim(), "89.97");
  });

  await test("write + read roundtrip", async () => {
    await bashExec.execute!({ command: 'printf "a,b\\n1,2\\n3,4" > /data/test_output.csv' }, ctx);
    const r = await bashExec.execute!({ command: "cat /data/test_output.csv" }, ctx);
    assert(r.stdout.includes("a,b"), "missing header");
    assert(r.stdout.includes("3,4"), "missing row");
  });

  await test("jq transforms and saves", async () => {
    await bashExec.execute!({
      command: 'cat /data/companies.json | jq "[.[] | {name, revenue}]" > /data/summary.json',
    }, ctx);
    const r = await bashExec.execute!({ command: "cat /data/summary.json" }, ctx);
    const data = JSON.parse(r.stdout);
    assertEq(data.length, 3);
    assert(!("employees" in data[0]), "should not have employees");
  });

  await test("unavailable commands fail", async () => {
    for (const cmd of ["python3 --version", "node -e '1'", "curl https://example.com", "wget https://example.com"]) {
      const r = await bashExec.execute!({ command: cmd }, ctx);
      assert(r.exitCode !== 0 || r.stderr.length > 0, `${cmd} should fail`);
    }
  });

  await test("math with awk", async () => {
    const r = await bashExec.execute!({ command: "awk 'BEGIN{printf \"%.2f\", 100 * 1.08}'" }, ctx);
    assertEq(r.stdout.trim(), "108.00");
  });

  await test("pipe chain works", async () => {
    const r = await bashExec.execute!({
      command: 'cat /data/prices.csv | awk -F, \'NR>1{print $1}\' | sort',
    }, ctx);
    const lines = r.stdout.trim().split("\n");
    assertEq(lines[0], "Widget A");
    assertEq(lines[2], "Widget C");
  });

  // ─── File Listing ───
  console.log("\n  \x1b[90m── file listing ──\x1b[0m");

  await test("listBashFiles finds all files", async () => {
    const files = await listBashFiles();
    const paths = files.map((f) => f.path);
    assert(paths.includes("/data/companies.json"), "missing companies.json");
    assert(paths.includes("/data/prices.csv"), "missing prices.csv");
    assert(paths.includes("/data/test_output.csv"), "missing test_output.csv");
    assert(paths.includes("/data/summary.json"), "missing summary.json");
  });

  await test("all files have valid sizes", async () => {
    const files = await listBashFiles();
    for (const f of files) {
      assert(f.size > 0, `${f.path} size is ${f.size}`);
    }
  });

  await test("readBashFile returns correct content", async () => {
    const content = await readBashFile("/data/prices.csv");
    assert(content.includes("product,price,currency"), "missing header");
    assert(content.includes("Widget B,49.99"), "missing Widget B");
  });

  await test("readBashFile empty for nonexistent", async () => {
    const content = await readBashFile("/data/does_not_exist.txt");
    assertEq(content, "");
  });

  // ─── formatOutput Tool ───
  console.log("\n  \x1b[90m── formatOutput ──\x1b[0m");

  await test("formatOutput JSON", async () => {
    const r = await formatOutput.execute!({
      format: "json",
      data: [{ name: "Test", value: 42 }],
    }, ctx);
    assertEq(r.format, "json");
    const parsed = JSON.parse(r.content);
    assertEq(parsed[0].name, "Test");
    assertEq(parsed[0].value, 42);
  });

  await test("formatOutput CSV", async () => {
    const r = await formatOutput.execute!({
      format: "csv",
      data: [{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }],
    }, ctx);
    assertEq(r.format, "csv");
    assert(r.content.includes("name"), "missing header");
    assert(r.content.includes("Alice"), "missing Alice");
    assert(r.content.includes("Bob"), "missing Bob");
  });

  await test("formatOutput CSV with column ordering", async () => {
    const r = await formatOutput.execute!({
      format: "csv",
      data: [{ z: 1, a: 2, m: 3 }],
      columns: ["a", "m", "z"],
    }, ctx);
    const header = r.content.split("\n")[0];
    assert(header.indexOf("a") < header.indexOf("m"), "a should come before m");
    assert(header.indexOf("m") < header.indexOf("z"), "m should come before z");
  });

  await test("formatOutput text passthrough", async () => {
    const r = await formatOutput.execute!({
      format: "text",
      data: "Hello world",
    }, ctx);
    assertEq(r.format, "text");
    assertEq(r.content, "Hello world");
  });

  await test("formatOutput JSON string data", async () => {
    const r = await formatOutput.execute!({
      format: "json",
      data: '{"key": "value"}',
    }, ctx);
    assertEq(r.format, "json");
    const parsed = JSON.parse(r.content);
    assertEq(parsed.key, "value");
  });

  // ─── End-to-end: bash → formatOutput pipeline ───
  console.log("\n  \x1b[90m── pipeline ──\x1b[0m");

  await test("bash collect → jq transform → formatOutput CSV", async () => {
    // Simulate: agent scrapes data, saves JSON, processes with jq, formats as CSV
    const scraped = [
      { company: "Vercel", plan: "Pro", price: 20 },
      { company: "Netlify", plan: "Pro", price: 19 },
      { company: "Railway", plan: "Pro", price: 5 },
    ];
    await bashExec.execute!({
      command: `printf '${JSON.stringify(scraped)}' > /data/pricing_raw.json`,
    }, ctx);

    // jq to extract fields
    const jqResult = await bashExec.execute!({
      command: 'cat /data/pricing_raw.json | jq "[.[] | {company, price}]"',
    }, ctx);
    assert(jqResult.exitCode === 0, "jq failed");

    const processed = JSON.parse(jqResult.stdout);
    // formatOutput to CSV
    const csvResult = await formatOutput.execute!({
      format: "csv",
      data: processed,
      columns: ["company", "price"],
    }, ctx);
    assert(csvResult.content.includes("company"), "missing company header");
    assert(csvResult.content.includes("Vercel"), "missing Vercel");
    assert(csvResult.content.includes("Railway"), "missing Railway");

    // Save to bash filesystem
    await bashExec.execute!({
      command: `printf '${csvResult.content.replace(/'/g, "'\\''")}' > /data/pricing_comparison.csv`,
    }, ctx);

    // Verify roundtrip
    const finalContent = await readBashFile("/data/pricing_comparison.csv");
    assert(finalContent.includes("Vercel"), "roundtrip failed — missing Vercel");
  });

  await test("file appears in listing after pipeline", async () => {
    const files = await listBashFiles();
    const paths = files.map((f) => f.path);
    assert(paths.includes("/data/pricing_comparison.csv"), "missing pricing_comparison.csv");
    assert(paths.includes("/data/pricing_raw.json"), "missing pricing_raw.json");
  });

  // ─── Summary ───
  console.log(`\n  \x1b[1m${passed} passed\x1b[0m, \x1b[${failed ? "31" : "90"}m${failed} failed\x1b[0m\n`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
