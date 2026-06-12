#!/usr/bin/env node
/**
 * Pre-flight check: verify required env vars are set, provider keys
 * match the selected model, and key formats look right.
 *
 *   npm run doctor
 */
import "dotenv/config";

type Status = "ok" | "fail" | "warn";
const checks: Array<{ name: string; status: Status; detail: string }> = [];

function add(name: string, status: Status, detail: string): void {
  checks.push({ name, status, detail });
}

// Known API key prefixes — a mismatch is a strong signal the user
// pasted the wrong key into the wrong variable.
const KEY_PREFIXES: Record<string, { prefix: string; label: string }> = {
  FIRECRAWL_API_KEY: { prefix: "fc-", label: "Firecrawl keys start with fc-" },
  ANTHROPIC_API_KEY: { prefix: "sk-ant-", label: "Anthropic keys start with sk-ant-" },
  OPENAI_API_KEY: { prefix: "sk-", label: "OpenAI keys start with sk-" },
  GOOGLE_GENERATIVE_AI_API_KEY: { prefix: "AIza", label: "Google AI keys start with AIza" },
  AI_GATEWAY_API_KEY: { prefix: "vck_", label: "AI Gateway keys start with vck_" },
};

function checkKey(envName: string, label: string, required: boolean): void {
  const value = process.env[envName];
  if (!value) {
    if (required) add(label, "fail", `missing — set ${envName}`);
    return;
  }
  const fmt = KEY_PREFIXES[envName];
  if (fmt && !value.startsWith(fmt.prefix)) {
    add(label, "warn", `format looks off — ${fmt.label} (got "${value.slice(0, 6)}...")`);
  } else {
    add(label, "ok", `set (${value.slice(0, 6)}...)`);
  }
}

// --- required ---
checkKey("FIRECRAWL_API_KEY", "FIRECRAWL_API_KEY", true);

// --- model provider + key ---
const provider = process.env.MODEL_PROVIDER ?? process.env.MODEL?.split(":")[0] ?? "google";
const providerKeyEnv: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  gateway: "AI_GATEWAY_API_KEY",
  "custom-openai": "CUSTOM_OPENAI_API_KEY",
  "atomic-chat": "ATOMIC_CHAT_API_KEY",
};
const requiredKey = providerKeyEnv[provider];
if (requiredKey && provider !== "atomic-chat") {
  checkKey(requiredKey, `${requiredKey} (for provider "${provider}")`, true);
} else if (provider === "atomic-chat") {
  const key = process.env.ATOMIC_CHAT_API_KEY;
  if (key) checkKey("ATOMIC_CHAT_API_KEY", "ATOMIC_CHAT_API_KEY (optional)", false);
}

// --- atomic-chat baseURL (optional override) ---
if (provider === "atomic-chat") {
  const baseURL = process.env.ATOMIC_CHAT_BASE_URL ?? "http://127.0.0.1:1337/v1";
  try {
    new URL(baseURL);
    add("ATOMIC_CHAT_BASE_URL", "ok", baseURL);
  } catch {
    add("ATOMIC_CHAT_BASE_URL", "fail", `invalid URL: "${baseURL}"`);
  }
}

// --- custom-openai baseURL ---
if (provider === "custom-openai") {
  const baseURL = process.env.CUSTOM_OPENAI_BASE_URL;
  if (baseURL) {
    try {
      new URL(baseURL);
      add("CUSTOM_OPENAI_BASE_URL", "ok", baseURL);
    } catch {
      add("CUSTOM_OPENAI_BASE_URL", "fail", `invalid URL: "${baseURL}"`);
    }
  } else {
    add("CUSTOM_OPENAI_BASE_URL", "fail", "missing — required for custom-openai provider");
  }
}

// --- report ---
const lines: string[] = [""];
const marks: Record<Status, string> = { ok: "✓", fail: "✗", warn: "⚠" };
for (const c of checks) {
  lines.push(`  ${marks[c.status]} ${c.name}: ${c.detail}`);
}
lines.push("");

const failed = checks.filter((c) => c.status === "fail").length;
const warned = checks.filter((c) => c.status === "warn").length;
if (failed === 0) {
  const note = warned > 0 ? ` (${warned} warning${warned === 1 ? "" : "s"})` : "";
  lines.push(`  All good${note}. Ready to run: npm start`);
  console.log(lines.join("\n"));
  process.exit(0);
} else {
  lines.push(`  ${failed} check(s) failed. Fix the issues above and try again.`);
  console.error(lines.join("\n"));
  process.exit(1);
}
