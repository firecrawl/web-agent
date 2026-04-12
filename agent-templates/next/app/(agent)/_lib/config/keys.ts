import fs from "fs";
import path from "path";
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

function readEnvFile(): Record<string, string> {
  try {
    const content = fs.readFileSync(ENV_FILE, "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0) vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
    return vars;
  } catch {
    return {};
  }
}

function writeEnvFile(vars: Record<string, string>) {
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_FILE, lines.join("\n") + "\n", "utf-8");
}

export function getKey(id: KeyId): string | undefined {
  const def = KEY_DEFS[id];
  // Priority: runtime override > process.env (which includes .env.local on dev)
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
