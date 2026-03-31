# TypeScript AI SDK Example (Direct Import)

This example imports `agent-core` directly as a TypeScript module.
No HTTP server, no REST API -- the agent runs in-process. This is the
deep integration path for TypeScript projects that want full control
over the agent lifecycle.

## Prerequisites

- Node.js 18+
- A Firecrawl API key (`FIRECRAWL_API_KEY`)
- A model provider API key (e.g. `GOOGLE_GENERATIVE_AI_API_KEY` for Gemini)

## Setup

From the project root:

```
npm install
```

## Run

```
FIRECRAWL_API_KEY=fc-... npx tsx examples/typescript-ai-sdk/index.ts
```

## How it works

`createAgent` returns a `FirecrawlAgent` instance backed by the Vercel AI SDK.
Calling `agent.run()` executes the full tool loop in-process -- search, scrape,
interact, bash, format -- and returns the final text, structured data, step
details, and token usage. No network round-trips to a separate server.
