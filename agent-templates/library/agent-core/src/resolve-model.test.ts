import { describe, it, expect, vi } from "vitest";
import { resolveModel } from "./resolve-model";

// Mock the AI SDK provider packages
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(({ apiKey, baseURL }: { apiKey?: string; baseURL?: string }) => {
    const provider = (model: string) => ({ provider: "openai", model, apiKey, baseURL });
    provider.chat = (model: string) => ({ provider: "openai-chat", model, apiKey, baseURL });
    return provider;
  }),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(({ apiKey }: { apiKey?: string }) => {
    return (model: string) => ({ provider: "anthropic", model, apiKey });
  }),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(({ apiKey }: { apiKey?: string }) => {
    return (model: string) => ({ provider: "google", model, apiKey });
  }),
}));

describe("resolveModel", () => {
  it("resolves google provider", async () => {
    const model = await resolveModel(
      { provider: "google", model: "gemini-3-flash-preview" },
      { google: "test-key" },
    );
    expect(model).toMatchObject({
      provider: "google",
      model: "gemini-3-flash-preview",
      apiKey: "test-key",
    });
  });

  it("resolves anthropic provider", async () => {
    const model = await resolveModel(
      { provider: "anthropic", model: "claude-sonnet-4-20250514" },
      { anthropic: "sk-ant-test" },
    );
    expect(model).toMatchObject({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: "sk-ant-test",
    });
  });

  it("resolves openai provider", async () => {
    const model = await resolveModel(
      { provider: "openai", model: "gpt-4o" },
      { openai: "sk-test" },
    );
    expect(model).toMatchObject({
      provider: "openai",
      model: "gpt-4o",
      apiKey: "sk-test",
    });
  });

  it("resolves gateway provider with correct baseURL", async () => {
    const model = await resolveModel(
      { provider: "gateway", model: "gpt-4o" },
      { gateway: "gw-key" },
    );
    expect(model).toMatchObject({
      provider: "openai-chat",
      model: "gpt-4o",
      apiKey: "gw-key",
      baseURL: "https://ai-gateway.vercel.sh/v1",
    });
  });

  it("resolves custom-openai with baseURL", async () => {
    const model = await resolveModel({
      provider: "custom-openai",
      model: "local-model",
      apiKey: "custom-key",
      baseURL: "http://localhost:8080/v1",
    });
    expect(model).toMatchObject({
      provider: "openai",
      model: "local-model",
      apiKey: "custom-key",
      baseURL: "http://localhost:8080/v1",
    });
  });

  it("throws for custom-openai without baseURL", async () => {
    await expect(
      resolveModel({
        provider: "custom-openai",
        model: "test",
      }),
    ).rejects.toThrow("CUSTOM_OPENAI_BASE_URL is not configured");
  });

  it("resolves atomic-chat with default baseURL and keyless token", async () => {
    const model = await resolveModel({
      provider: "atomic-chat",
      model: "local-model",
    });
    expect(model).toMatchObject({
      provider: "openai",
      model: "local-model",
      apiKey: "atomic-chat-local",
      baseURL: "http://127.0.0.1:1337/v1",
    });
  });

  it("resolves atomic-chat with custom baseURL and api key", async () => {
    const model = await resolveModel(
      { provider: "atomic-chat", model: "qwen-local" },
      { "atomic-chat": "my-key", "atomic-chat:baseURL": "http://host.docker.internal:1337/v1" },
    );
    expect(model).toMatchObject({
      provider: "openai",
      model: "qwen-local",
      apiKey: "my-key",
      baseURL: "http://host.docker.internal:1337/v1",
    });
  });

  it("prefers config.apiKey over apiKeys map", async () => {
    const model = await resolveModel(
      { provider: "google", model: "gemini-flash", apiKey: "config-key" },
      { google: "map-key" },
    );
    expect(model).toMatchObject({ apiKey: "config-key" });
  });

  it("throws for unsupported provider with supported-list hint", async () => {
    await expect(
      resolveModel({ provider: "unknown" as never, model: "test" }),
    ).rejects.toThrow(/Supported: anthropic, openai, google/);
  });

  it("suggests provider prefix when the 'provider' looks like a model ID", async () => {
    await expect(
      resolveModel({ provider: "claude-sonnet-4-6" as never, model: "test" }),
    ).rejects.toThrow(/Did you mean MODEL="anthropic:claude-sonnet-4-6"/);
  });
});
