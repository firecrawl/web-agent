import fs from "fs";
import path from "path";
import { timingSafeEqual } from "crypto";
import type { ModelConfig } from "@/agent-core-types";

const ENV_FILE = path.join(process.cwd(), ".env.local");

export const KEY_DEFS = {
  firecrawl: { env: "FIRECRAWL_API_KEY", label: "Firecrawl", placeholder: "fc-..." },
  anthropic: { env: "ANTHROPIC_API_KEY", label: "Anthropic", placeholder: "sk-ant-..." },
  openai: { env: "OPENAI_API_KEY", label: "OpenAI", placeholder: "sk-..." },
  google: { env: "GOOGLE_GENERATIVE_AI_API_KEY", label: "Google AI", placeholder: "AI..." },
  gateway: { env: "AI_GATEWAY_API_KEY", label: "AI Gateway", placeholder: "vck_..." },
  customOpenAI: { env: "CUSTOM_OPENAI_API_KEY", label: "Custom OpenAI", placeholder: "sk-..." },
} as const;

export type KeyId = keyof typeof KEY_DEFS;

export const VALUE_DEFS = {
  customOpenAIBaseURL: {
    env: "CUSTOM_OPENAI_BASE_URL",
    label: "Base URL",
    placeholder: "https://openrouter.ai/api/v1",
  },
} as const;

export type ValueId = keyof typeof VALUE_DEFS;

// Runtime overrides from BYOK (in-memory for hosted, file for local)
const runtimeOverrides: Partial<Record<string, string>> = {};

export function isHosted(): boolean {
  return !!(process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.FLY_APP_NAME || process.env.RENDER);
}

// Constant-time compare. Length difference is normalized by always
// comparing buffers of equal length — we compare `b` with itself when
// lengths differ so timing can't leak the token length.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    timingSafeEqual(bb, bb);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/**
 * Guard mutating config routes (POST /api/config).
 *
 * - CONFIG_ADMIN_TOKEN set → require matching `Authorization: Bearer <token>`.
 * - CONFIG_ADMIN_TOKEN set but empty ("") → always deny 500. This prevents
 *   a misconfigured deploy (blank token in dashboard) from silently opening
 *   the endpoint.
 * - Unset and running on a detected hosted platform (Vercel, Railway, Fly,
 *   Render) → deny. Hosted deployments are public; config writes must be
 *   explicitly armed.
 * - Unset and running locally → allow. Local dev is trusted.
 *
 * ⚠️ `isHosted()` is inference-based. Self-hosted Docker on a public VPS
 *    without the recognized env flags will return false — set
 *    CONFIG_ADMIN_TOKEN explicitly on any internet-exposed deployment.
 */
export function requireConfigWriteAuth(req: Request): Response | null {
  const token = process.env.CONFIG_ADMIN_TOKEN;
  if (token !== undefined) {
    if (token === "") {
      return Response.json(
        { error: "CONFIG_ADMIN_TOKEN is set but empty — refusing writes" },
        { status: 500 },
      );
    }
    const header = req.headers.get("authorization") ?? "";
    const match = /^Bearer\s+(\S.*)$/i.exec(header);
    if (!match || !safeEqual(match[1], token)) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return null;
  }
  if (isHosted()) {
    return Response.json(
      { error: "CONFIG_ADMIN_TOKEN is required to write config on hosted deployments" },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Guard read access to config on hosted deployments. Without this, anyone
 * can GET masked key previews and discover which providers are wired —
 * info disclosure. Locally, reads stay open (trusted dev env).
 *
 * Returns a Response to short-circuit, or null to proceed.
 */
export function requireConfigReadAuth(req: Request): Response | null {
  if (!isHosted()) return null;
  const token = process.env.CONFIG_ADMIN_TOKEN;
  if (token === undefined) {
    // No token set on hosted → deny reads too; the UI can still render
    // an empty state and prompt the admin to configure CONFIG_ADMIN_TOKEN.
    return Response.json(
      { error: "CONFIG_ADMIN_TOKEN is required to read config on hosted deployments" },
      { status: 403 },
    );
  }
  return requireConfigWriteAuth(req);
}

/**
 * Reject env values that would break out of their line in .env.local or
 * trip dotenv's quote-aware parser. Applied to every value written via
 * the config API. Rejected characters:
 *   \r \n \0  — would split the line and inject a second env var
 *   "  '      — would terminate an implicit quoted value and let the
 *               rest of the line become a new `KEY=value` pair when the
 *               parser (e.g. `@next/env`, `dotenv`) re-reads the file
 *   \         — backslash escapes are parser-dependent; reject to keep
 *               round-trip predictable
 *   #         — a mid-line `#` is treated as a comment by most dotenv
 *               parsers and would truncate the value silently
 *   $         — `${OTHER_VAR}` triggers variable expansion in dotenv /
 *               @next/env and would let a submitted value exfiltrate
 *               other env contents on re-parse
 *   whitespace — unquoted space/tab in `KEY=a b` gets parsed as just
 *               `a`; writeEnvFile doesn't quote, so reject here instead
 *               of adding asymmetric quoting logic
 * API keys, base URLs, OAuth/JWT tokens, and base64 strings never
 * legitimately contain any of these, so rejecting is safe.
 */
export function isSafeEnvValue(v: unknown): v is string {
  return typeof v === "string" && !/[\r\n\0"'\\#$\s]/.test(v);
}

// Strip one layer of balanced surrounding quotes (" or ') from a .env value.
// dotenv writes quoted values for anything containing spaces; without this,
// readEnvFile would round-trip `KEY="abc"` as the literal string `"abc"`
// (with the quote characters included), poisoning process.env on writeback.
function stripQuotes(v: string): string {
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return v.slice(1, -1);
    }
  }
  return v;
}

function readEnvFile(): Record<string, string> {
  try {
    const content = fs.readFileSync(ENV_FILE, "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0) vars[trimmed.slice(0, eq)] = stripQuotes(trimmed.slice(eq + 1));
    }
    return vars;
  } catch {
    return {};
  }
}

// readEnvFile strips surrounding quotes, so we lose the knowledge that a
// user's pre-existing value was originally quoted. Re-quote on write
// whenever the value contains a character that dotenv would otherwise
// mis-parse, escaping backslash and double-quote inside the quoted form.
// Managed keys (filtered by isSafeEnvValue) never hit this branch; it
// exists to preserve unrelated entries like FOO="a b" across round-trip.
function writeEnvFile(vars: Record<string, string>) {
  const lines = Object.entries(vars).map(([k, v]) => {
    if (!/[\s"'#$\\]/.test(v)) return `${k}=${v}`;
    const escaped = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `${k}="${escaped}"`;
  });
  fs.writeFileSync(ENV_FILE, lines.join("\n") + "\n", "utf-8");
}

// Priority: runtime override (BYOK) > process.env (which includes
// .env.local on dev, or the platform's injected env on hosted).
// Clearing an override falls back to process.env by design — on hosted
// this is the platform's key; on local setKey also clears process.env
// so the fallback is empty anyway.
export function getKey(id: KeyId): string | undefined {
  const def = KEY_DEFS[id];
  return runtimeOverrides[def.env] || process.env[def.env] || undefined;
}

export function getFirecrawlKey(): string | undefined {
  return getKey("firecrawl");
}

export function getProviderKey(provider: string): string | undefined {
  const map: Record<string, KeyId> = {
    anthropic: "anthropic",
    openai: "openai",
    google: "google",
    gateway: "gateway",
    "custom-openai": "customOpenAI",
  };
  const id = map[provider];
  return id ? getKey(id) : undefined;
}

export function getValue(id: ValueId): string | undefined {
  const def = VALUE_DEFS[id];
  return runtimeOverrides[def.env] || process.env[def.env] || undefined;
}

export function getCustomOpenAIBaseURL(): string | undefined {
  return getValue("customOpenAIBaseURL");
}

export function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? "****" : "";
  return key.slice(0, 6) + "..." + key.slice(-4);
}

export function getKeyStatus(): Record<KeyId, { configured: boolean; masked: string; source: string }> {
  const hosted = isHosted();
  const status = {} as Record<KeyId, { configured: boolean; masked: string; source: string }>;

  for (const [id, def] of Object.entries(KEY_DEFS) as [KeyId, (typeof KEY_DEFS)[KeyId]][]) {
    const override = runtimeOverrides[def.env];
    const envValue = process.env[def.env];
    const value = override || envValue;

    if (value) {
      const source = override ? "user" : hosted ? "environment" : "env.local";
      status[id] = { configured: true, masked: maskKey(value), source };
    } else {
      status[id] = { configured: false, masked: "", source: "" };
    }
  }

  return status;
}

export function getValueStatus(): Record<ValueId, { configured: boolean; value: string; source: string }> {
  const hosted = isHosted();
  const status = {} as Record<ValueId, { configured: boolean; value: string; source: string }>;

  for (const [id, def] of Object.entries(VALUE_DEFS) as [ValueId, (typeof VALUE_DEFS)[ValueId]][]) {
    const override = runtimeOverrides[def.env];
    const envValue = process.env[def.env];
    const value = override || envValue;

    if (value) {
      const source = override ? "user" : hosted ? "environment" : "env.local";
      status[id] = { configured: true, value, source };
    } else {
      status[id] = { configured: false, value: "", source: "" };
    }
  }

  return status;
}

export function setKey(id: KeyId, value: string) {
  const def = KEY_DEFS[id];
  if (!def) return;

  if (isHosted()) {
    // In hosted mode, store in memory only (per-session)
    if (value) {
      runtimeOverrides[def.env] = value;
    } else {
      delete runtimeOverrides[def.env];
    }
  } else {
    // In local mode, write to .env.local AND update process.env
    const existing = readEnvFile();
    if (value) {
      existing[def.env] = value;
      process.env[def.env] = value;
    } else {
      delete existing[def.env];
      delete process.env[def.env];
    }
    writeEnvFile(existing);
  }
}

export function setValue(id: ValueId, value: string) {
  const def = VALUE_DEFS[id];
  if (!def) return;

  if (isHosted()) {
    if (value) {
      runtimeOverrides[def.env] = value;
    } else {
      delete runtimeOverrides[def.env];
    }
  } else {
    const existing = readEnvFile();
    if (value) {
      existing[def.env] = value;
      process.env[def.env] = value;
    } else {
      delete existing[def.env];
      delete process.env[def.env];
    }
    writeEnvFile(existing);
  }
}

export function getProviderApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const provider of ["anthropic", "openai", "google", "gateway", "custom-openai"] as const) {
    const key = getProviderKey(provider);
    if (key) keys[provider] = key;
  }
  const baseURL = getCustomOpenAIBaseURL();
  if (baseURL) keys["custom-openai:baseURL"] = baseURL;
  return keys;
}

export function hydrateModelConfig(model: ModelConfig): ModelConfig {
  if (model.provider !== "custom-openai" || model.baseURL) return model;
  const baseURL = getCustomOpenAIBaseURL();
  return baseURL ? { ...model, baseURL } : model;
}
