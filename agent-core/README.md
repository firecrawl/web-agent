# Agent Core

The core agent logic. Pure TypeScript, no framework dependencies. Built on the [Vercel AI SDK](https://sdk.vercel.ai/) and [Firecrawl](https://firecrawl.dev/).

## What it does

Agent Core is a web research agent that can search, scrape, and extract structured data from any website. It handles orchestration, parallel workers, skill loading, and output formatting.

## Public API

```typescript
import { createAgent } from '@firecrawl/agent-core'

const agent = createAgent({
  firecrawlApiKey: 'fc-...',
  model: { provider: 'google', model: 'gemini-3-flash-preview' },
})

// Simple query
const result = await agent.run({ prompt: 'get pricing for Vercel' })
console.log(result.text)

// Structured extraction
const data = await agent.run({
  prompt: 'get Vercel pricing',
  format: 'json',
  schema: { type: 'array', items: { properties: { plan: { type: 'string' }, price: { type: 'string' } } } }
})

// Streaming
for await (const event of agent.stream({ prompt: '...' })) {
  if (event.type === 'text') process.stdout.write(event.content)
}

// Planning only (no execution)
const plan = await agent.plan('compare pricing across 5 CDN providers')
```

## Configuration

```typescript
createAgent({
  firecrawlApiKey: string,          // Required
  model: ModelConfig,                // { provider, model }
  subAgentModel?: ModelConfig,       // For parallel workers (defaults to model)
  apiKeys?: Record<string, string>,  // { google: '...', anthropic: '...', openai: '...' }
  skillsDir?: string,                // Path to custom skills (default: .agents/skills/)
  maxSteps?: number,                 // Max agent steps (default: 20)
  maxWorkers?: number,               // Max parallel workers (default: 6)
  workerMaxSteps?: number,           // Max steps per worker (default: 10)
})
```

## Run parameters

```typescript
agent.run({
  prompt: string,                    // The research task
  urls?: string[],                   // Seed URLs to start from
  schema?: object,                   // JSON schema for structured output
  format?: 'json' | 'csv' | 'markdown',
  columns?: string[],                // Column names for CSV
  uploads?: UploadedFile[],          // Files to make available in bash sandbox
  skills?: string[],                 // Skills to pre-load
  maxSteps?: number,                 // Override per-run
  onStep?: (event) => void,          // Progress callback
})
```

## Architecture

```
createAgent()
  └── createOrchestrator()
        ├── Firecrawl tools (search, scrape, interact)
        ├── Skills (load_skill, read_skill_resource)
        ├── Sub-agents (JSON/CSV/Markdown creators)
        ├── Parallel workers (spawnAgents tool)
        ├── Bash sandbox (bashExec)
        └── Output formatter (formatOutput)
```

## OpenAPI Spec

`openapi.yaml` describes the HTTP interface for the agent. Use it to auto-generate typed clients for any language:

```bash
./scripts/generate-sdks.sh
```

## Files

| File | Purpose |
|------|---------|
| `src/agent.ts` | `createAgent()` — the public API |
| `src/orchestrator.ts` | Agent setup, tool wiring, prompt loading |
| `src/workers.ts` | Parallel worker execution |
| `src/sub-agents.ts` | Delegated sub-agent tasks |
| `src/tools.ts` | formatOutput + bashExec tools |
| `src/resolve-model.ts` | Multi-provider model resolution |
| `src/skills/` | Skill discovery, parsing, tool creation |
| `src/prompts/` | Orchestrator and worker prompt templates |
| `src/types.ts` | All TypeScript types |
| `openapi.yaml` | HTTP API specification |
