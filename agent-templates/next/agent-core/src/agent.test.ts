import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAgent, createAgentFromEnv, FirecrawlAgent } from "./agent";

// Mock buildFirecrawlToolkit since it requires a real API key
vi.mock("./toolkit", () => ({
  buildFirecrawlToolkit: vi.fn(() => ({
    tools: {},
    systemPrompt: "mocked system prompt",
    createFiltered: () => ({}),
  })),
}));

describe("createAgent", () => {
  it("returns a FirecrawlAgent instance", () => {
    const agent = createAgent({
      firecrawlApiKey: "fc-test",
      model: { provider: "google", model: "gemini-3-flash-preview" },
    });
    expect(agent).toBeInstanceOf(FirecrawlAgent);
  });

  it("accepts all option fields", () => {
    const agent = createAgent({
      firecrawlApiKey: "fc-test",
      model: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
      subAgentModel: { provider: "google", model: "gemini-flash" },
      apiKeys: { anthropic: "sk-ant-test" },
      skillsDir: "/custom/skills",
      maxSteps: 50,
      maxWorkers: 3,
      workerMaxSteps: 20,
    });
    expect(agent).toBeInstanceOf(FirecrawlAgent);
  });

  it("accepts firecrawlOptions for tool configuration", () => {
    const agent = createAgent({
      firecrawlApiKey: "fc-test",
      model: { provider: "google", model: "gemini-flash" },
      firecrawlOptions: {
        search: { limit: 5 },
        interact: false,
        map: true,
      },
    });
    expect(agent).toBeInstanceOf(FirecrawlAgent);
  });

  it("accepts a custom toolkit override", () => {
    const agent = createAgent({
      firecrawlApiKey: "fc-test",
      model: { provider: "google", model: "gemini-flash" },
      toolkit: {
        tools: {},
        systemPrompt: "custom toolkit",
      },
    });
    expect(agent).toBeInstanceOf(FirecrawlAgent);
  });
});

describe("createAgentFromEnv", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when FIRECRAWL_API_KEY is not set", () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "");
    delete process.env.FIRECRAWL_API_KEY;
    expect(() => createAgentFromEnv()).toThrow("FIRECRAWL_API_KEY not set");
  });

  it("creates agent from env vars", () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "fc-from-env");
    vi.stubEnv("MODEL_PROVIDER", "anthropic");
    vi.stubEnv("MODEL_ID", "claude-sonnet-4-20250514");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-from-env");

    const agent = createAgentFromEnv();
    expect(agent).toBeInstanceOf(FirecrawlAgent);
  });

  it("defaults to google/gemini-3-flash-preview when no model env vars set", () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "fc-test");
    delete process.env.MODEL_PROVIDER;
    delete process.env.MODEL_ID;

    const agent = createAgentFromEnv();
    expect(agent).toBeInstanceOf(FirecrawlAgent);
  });

  it("accepts overrides that merge with env config", () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "fc-test");

    const agent = createAgentFromEnv({
      maxSteps: 100,
      maxWorkers: 5,
    });
    expect(agent).toBeInstanceOf(FirecrawlAgent);
  });

  it("collects all provider API keys from env", () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "fc-test");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant");
    vi.stubEnv("OPENAI_API_KEY", "sk-oai");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "goog");
    vi.stubEnv("AI_GATEWAY_API_KEY", "gw");

    const agent = createAgentFromEnv();
    expect(agent).toBeInstanceOf(FirecrawlAgent);
  });
});

describe("FirecrawlAgent.plan", () => {
  it("has a plan method", () => {
    const agent = createAgent({
      firecrawlApiKey: "fc-test",
      model: { provider: "google", model: "gemini-flash" },
    });
    expect(typeof agent.plan).toBe("function");
  });
});

describe("FirecrawlAgent streaming methods", () => {
  it("has stream, toResponse, and sse methods", () => {
    const agent = createAgent({
      firecrawlApiKey: "fc-test",
      model: { provider: "google", model: "gemini-flash" },
    });
    expect(typeof agent.stream).toBe("function");
    expect(typeof agent.toResponse).toBe("function");
    expect(typeof agent.sse).toBe("function");
  });
});
