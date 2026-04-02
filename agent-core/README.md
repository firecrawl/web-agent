# Agent Core

The core agent logic. Pure TypeScript, no framework dependencies. Built on [firecrawl-aisdk](https://www.npmjs.com/package/firecrawl-aisdk).

This is what all [templates](../templates/) share. You can also use it directly as a library.

## Quick start

**Via CLI** — scaffold a project that includes agent-core:

```bash
firecrawl-agent init my-agent -t express
```

**As a library** — import directly:

```typescript
import { createAgent } from '@firecrawl/agent-core'

const agent = createAgent({
  firecrawlApiKey: 'fc-...',
  model: { provider: 'google', model: 'gemini-3-flash-preview' },
})

const result = await agent.run({ prompt: 'get pricing for Vercel' })
```

## API

### `createAgent(options)`

```typescript
createAgent({
  firecrawlApiKey: string,          // required
  model: ModelConfig,                // { provider, model }
  subAgentModel?: ModelConfig,       // for parallel workers (defaults to model)
  apiKeys?: Record<string, string>,  // { google: '...', anthropic: '...', openai: '...' }
  skillsDir?: string,                // path to custom skills
  maxSteps?: number,                 // max agent steps (default: 20)
  maxWorkers?: number,               // max parallel workers (default: 6)
  workerMaxSteps?: number,           // max steps per worker (default: 10)
})
```

### `agent.run(params)`

Run to completion:

```typescript
const result = await agent.run({
  prompt: string,                    // the research task (required)
  urls?: string[],                   // seed URLs
  schema?: object,                   // JSON schema for structured output
  format?: 'json' | 'csv' | 'markdown',
  columns?: string[],                // column names for CSV
  skills?: string[],                 // skills to pre-load
  maxSteps?: number,                 // override per-run
})
```

### `agent.stream(params)`

Stream events as they happen:

```typescript
for await (const event of agent.stream({ prompt: '...' })) {
  if (event.type === 'text') process.stdout.write(event.content)
}
```

### `agent.plan(prompt)`

Plan without executing:

```typescript
const plan = await agent.plan('compare pricing across 5 CDN providers')
```

## Providers

| Provider | Config |
|----------|--------|
| Google Gemini | `{ provider: 'google', model: 'gemini-3-flash-preview' }` |
| Anthropic Claude | `{ provider: 'anthropic', model: 'claude-sonnet-4-20250514' }` |
| OpenAI | `{ provider: 'openai', model: 'gpt-4o' }` |

Set API keys via `apiKeys` option or environment variables (`GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).

## Architecture

```
createAgent()
  └── Orchestrator
        ├── Firecrawl tools (search, scrape, interact)
        ├── Skills (domain-specific knowledge)
        ├── Parallel workers (concurrent sub-tasks)
        ├── Bash sandbox
        └── Output formatter (JSON, CSV, Markdown)
```

## OpenAPI spec

[`openapi.yaml`](./openapi.yaml) describes the HTTP API. All [templates](../templates/) implement it, all [SDKs](../sdks/) are generated from it.

## Files

| File | Purpose |
|------|---------|
| `src/agent.ts` | `createAgent()` public API |
| `src/orchestrator/` | Agent setup, tool wiring, prompt loading |
| `src/worker/` | Parallel worker execution |
| `src/skills/` | Skill discovery, parsing, tools |
| `src/toolkit.ts` | Firecrawl SDK integration |
| `src/tools.ts` | formatOutput + bashExec |
| `src/resolve-model.ts` | Multi-provider model resolution |
| `src/types.ts` | TypeScript types |
| `openapi.yaml` | HTTP API specification |
