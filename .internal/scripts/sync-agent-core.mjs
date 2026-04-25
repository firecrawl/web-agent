#!/usr/bin/env node
/**
 * Copy canonical agent-core/ into each template (replaces symlinks).
 *
 * Usage (from firecrawl-agent repo root):
 *   node .internal/scripts/sync-agent-core.mjs
 *   node .internal/scripts/sync-agent-core.mjs --dry-run
 *   node .internal/scripts/sync-agent-core.mjs --target agent-templates/next
 *   node .internal/scripts/sync-agent-core.mjs --check     # CI drift check
 *
 * Optional: materialize under /tmp only (inspect before committing):
 *   node .internal/scripts/sync-agent-core.mjs --tmp
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file lives at .internal/scripts/ → repo root is two levels up
const REPO_ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(REPO_ROOT, "agent-core");

const DEFAULT_TARGETS = [
  "agent-templates/next",
  "agent-templates/express",
  "agent-templates/library",
];

const RSYNC_EXCLUDES = [
  "node_modules",
  "dist",
  "coverage",
  ".turbo",
  "*.tsbuildinfo",
  ".DS_Store",
  // Templates vendor agent-core as source; they don't install from the
  // vendored package.json and its lockfile would just be dead weight
  // polluting diffs. Keep agent-core's own pnpm-lock.yaml out of the sync.
  "pnpm-lock.yaml",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const tmpOnly = args.includes("--tmp");
  const check = args.includes("--check");
  const ti = args.indexOf("--target");
  const target =
    ti >= 0 && args[ti + 1] ? args[ti + 1] : null;
  return { dryRun, tmpOnly, check, target };
}

function assertSrc() {
  const marker = path.join(SRC, "src", "index.ts");
  if (!fs.existsSync(marker)) {
    console.error(`Expected agent-core at ${SRC} (missing src/index.ts). Run from firecrawl-agent repo root.`);
    process.exit(1);
  }
}

function clearDest(destAgentCore) {
  if (!fs.existsSync(destAgentCore)) return;
  const st = fs.lstatSync(destAgentCore);
  if (st.isSymbolicLink()) {
    fs.unlinkSync(destAgentCore);
    return;
  }
  if (st.isDirectory()) {
    fs.rmSync(destAgentCore, { recursive: true, force: true });
  }
}

function syncWithRsync(destDir) {
  const excludes = RSYNC_EXCLUDES.map((e) => `--exclude=${e}`).join(" ");
  const cmd = `rsync -a ${excludes} "${SRC}/" "${destDir}/"`;
  execSync(cmd, { stdio: "inherit", cwd: REPO_ROOT });
}

function syncWithCp(destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execSync(`cp -R "${SRC}/." "${destDir}/"`, { stdio: "inherit", cwd: REPO_ROOT });
  for (const ex of ["node_modules", "dist", "coverage"]) {
    const p = path.join(destDir, ex);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }
}

function hasRsync() {
  try {
    execSync("rsync --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function checkSync() {
  // Sync each target into a tmp dir, diff against the live copy.
  // Exit 1 if any differ. Used by CI to catch drift.
  const tmpBase = path.join(fs.realpathSync("/tmp"), `agent-core-check-${Date.now()}`);
  fs.mkdirSync(tmpBase, { recursive: true });
  let drift = 0;
  for (const t of DEFAULT_TARGETS) {
    const tmpCopy = path.join(tmpBase, t);
    fs.mkdirSync(tmpCopy, { recursive: true });
    syncWithRsync(tmpCopy);
    const live = path.join(REPO_ROOT, t, "agent-core");
    try {
      execSync(`diff -r "${tmpCopy}" "${live}"`, { stdio: "pipe" });
      console.log(`  ✓ ${t} in sync`);
    } catch {
      console.error(`  ✗ ${t} out of sync with agent-core/`);
      drift++;
    }
  }
  fs.rmSync(tmpBase, { recursive: true, force: true });
  if (drift > 0) {
    console.error(`\n${drift} template(s) out of sync. Run:`);
    console.error(`  node .internal/scripts/sync-agent-core.mjs`);
    process.exit(1);
  }
  console.log(`\nAll templates in sync with agent-core/.`);
}

function main() {
  const { dryRun, tmpOnly, check, target } = parseArgs();
  assertSrc();

  if (check) {
    if (!hasRsync()) {
      console.error("--check requires rsync");
      process.exit(2);
    }
    checkSync();
    return;
  }

  let targets;
  if (tmpOnly) {
    const tmp = path.join(fs.realpathSync("/tmp"), `agent-core-sync-${Date.now()}`);
    targets = [{ label: tmp, destCore: tmp }];
    console.log(`--tmp: will copy to ${tmp}\n`);
  } else if (target) {
    targets = [{ label: target, destCore: path.join(REPO_ROOT, target, "agent-core") }];
  } else {
    targets = DEFAULT_TARGETS.map((t) => ({
      label: t,
      destCore: path.join(REPO_ROOT, t, "agent-core"),
    }));
  }

  const useRsync = hasRsync();
  if (!useRsync) console.warn("rsync not found; using cp -R (slower, prune excludes manually)\n");

  for (const { label, destCore } of targets) {
    if (tmpOnly) {
      fs.mkdirSync(destCore, { recursive: true });
    }
    console.log(`→ ${label}`);
    if (dryRun) {
      console.log(`  [dry-run] would sync into ${destCore}`);
      continue;
    }
    if (!tmpOnly) {
      const parent = path.dirname(destCore);
      if (!fs.existsSync(parent)) {
        console.error(`  skip: parent missing ${parent}`);
        continue;
      }
      clearDest(destCore);
      fs.mkdirSync(destCore, { recursive: true });
    } else {
      clearDest(destCore);
      fs.mkdirSync(destCore, { recursive: true });
    }
    if (useRsync) syncWithRsync(destCore);
    else syncWithCp(destCore);
    console.log(`  done.\n`);
  }

  if (dryRun) return;
  if (tmpOnly) {
    console.log(`Inspect the copy under the path above, then run without --tmp to write templates.`);
  } else {
    console.log(`Next: git add agent-templates/*/agent-core && git status`);
  }
}

main();
