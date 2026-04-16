#!/usr/bin/env node
/**
 * Pre-flight check for `npm run dev` and `npm run build`.
 *
 * Verifies:
 *   1. node_modules/ is installed (catches missing / partial installs before
 *      the shell hits `sh: next: command not found`).
 *   2. agent-core/ is a vendored copy at ./agent-core (see
 *      ../../../.internal/scripts/sync-agent-core.mjs). Missing or empty
 *      agent-core → opaque build failures on Vercel.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function box(title, body, fix) {
  const width = 82;
  const line = "─".repeat(width);
  const pad = (s) => (s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length));
  const row = (s) => `│${pad(` ${s}`)}│`;
  const sep = `├${line}┤`;
  const out = [`┌${line}┐`, row(title), sep, ...body.map(row)];
  if (fix.length) out.push(sep, row("Fix:"), ...fix.map((f) => row(`  ${f}`)));
  out.push(`└${line}┘`);
  console.error("\n" + out.join("\n") + "\n");
}

// --- 1. node_modules/ check ---
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!fs.existsSync(nextBin)) {
  const hasNodeModules = fs.existsSync(path.join(root, "node_modules"));
  box(
    "node_modules is missing or incomplete",
    [
      `Expected:  node_modules/next/dist/bin/next`,
      `Got:       ${hasNodeModules ? "node_modules exists but next is missing (partial install)" : "no node_modules directory"}`,
    ],
    [
      "pnpm install   # or npm install",
      "",
      "If you get a mixed-install error, remove stale metadata first:",
      "  rm -rf node_modules/.pnpm node_modules/.package-lock.json && pnpm install",
    ],
  );
  process.exit(1);
}

// --- 2. agent-core/ check ---
function isBrokenSymlink(p) {
  try {
    const st = fs.lstatSync(p);
    if (!st.isSymbolicLink()) return false;
    const target = path.resolve(path.dirname(p), fs.readlinkSync(p));
    return !fs.existsSync(target);
  } catch {
    return true;
  }
}

const acPath = path.join(root, "agent-core");
const acMarker = path.join(root, "agent-core", "src", "index.ts");

if (!fs.existsSync(acMarker)) {
  const broken = fs.existsSync(acPath) && isBrokenSymlink(acPath);
  box(
    "agent-core is missing or incomplete",
    [
      `Expected:  agent-core/src/index.ts`,
      `Got:       ${fs.existsSync(acPath) ? (broken ? "broken symlink (target not in repo)" : "incomplete folder") : "nothing at ./agent-core"}`,
    ],
    [
      "From firecrawl-agent repo root run:",
      "  node .internal/scripts/sync-agent-core.mjs",
      "",
      "Standalone fork: copy agent-core/ from upstream or run that script",
      "once, then commit the vendored folder.",
    ],
  );
  process.exit(1);
}
