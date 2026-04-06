# Agent Core

The core agent logic. Built on [firecrawl-aisdk](https://www.npmjs.com/package/firecrawl-aisdk) and the [Vercel AI SDK](https://sdk.vercel.ai/).

This is what all [templates](../agent-templates/) share. You can also use it directly as a library.

## Quick start

**Via CLI** - scaffold a project that includes agent-core:

```bash
firecrawl-agent init my-agent -t express
```

**As a library** - import directly:

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
  skillInstructions?: Record<string, string>,  // per-skill custom instructions
  subAgents?: SubAgentConfig[],      // custom sub-agents for this run
  maxSteps?: number,                 // override per-run
  exportSkill?: boolean,             // generate reusable skill from the run
})
```

#### Sub-agents

Define specialized sub-agents with their own instructions, tools, skills, and step limits:

```typescript
const result = await agent.run({
  prompt: 'Build a competitive analysis of Vercel, Netlify, and Cloudflare Pages',
  subAgents: [
    {
      id: 'pricing_analyst',
      name: 'Pricing Analyst',
      description: 'Extract and compare pricing tiers across platforms',
      instructions: 'Focus exclusively on pricing data. Extract every tier, its price, and included limits. Ignore marketing copy.',
      model: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      tools: ['scrape'],
      skills: ['price-tracker'],
      maxSteps: 20,
    },
    {
      id: 'feature_reviewer',
      name: 'Feature Reviewer',
      description: 'Catalog features and developer experience across platforms',
      instructions: 'Look at docs and changelog, not just marketing pages. Note what each platform does that the others do not.',
      model: { provider: 'google', model: 'gemini-3-flash-preview' },
      tools: ['search', 'scrape'],
      skills: ['deep-research'],
      maxSteps: 15,
    },
  ],
  format: 'json',
})
```

```typescript
// E-commerce: one agent per retailer, each with site-specific instructions
const result = await agent.run({
  prompt: 'Find the best price for a Sony WH-1000XM5 across major retailers',
  subAgents: [
    {
      id: 'amazon',
      name: 'Amazon Scraper',
      description: 'Check Amazon product listing and price',
      instructions: 'Navigate to the product page directly. Extract current price, Prime price if different, and any active coupons.',
      model: { provider: 'google', model: 'gemini-3-flash-preview' },
      tools: ['search', 'scrape', 'interact'],
      skills: ['e-commerce'],
      maxSteps: 8,
    },
    {
      id: 'bestbuy',
      name: 'Best Buy Scraper',
      description: 'Check Best Buy product listing and price',
      instructions: 'Check both the regular price and any open-box/renewed options. Note member pricing if visible.',
      model: { provider: 'google', model: 'gemini-3-flash-preview' },
      tools: ['search', 'scrape'],
      skills: ['e-commerce'],
      maxSteps: 8,
    },
  ],
})
```

```typescript
// Financial research: give each agent a different data source
const result = await agent.run({
  prompt: 'Get a complete financial overview of NVIDIA',
  subAgents: [
    {
      id: 'sec_filings',
      name: 'SEC Filing Analyst',
      description: 'Pull key metrics from latest 10-K and 10-Q',
      instructions: 'Go to SEC EDGAR directly. Extract revenue, net income, EPS, and guidance from the most recent quarterly filing.',
      model: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
      tools: ['search', 'scrape'],
      skills: ['financial-data'],
      maxSteps: 12,
    },
    {
      id: 'analyst_consensus',
      name: 'Analyst Consensus Tracker',
      description: 'Gather analyst ratings and price targets',
      instructions: 'Check Yahoo Finance and TipRanks. Get the consensus rating, average price target, and range.',
      model: { provider: 'google', model: 'gemini-3-flash-preview' },
      tools: ['search', 'scrape'],
      skills: ['finance'],
      maxSteps: 10,
    },
  ],
  schema: {
    ticker: 'NVDA',
    revenue: null,
    netIncome: null,
    eps: null,
    analystRating: null,
    priceTarget: { average: null, low: null, high: null },
    sources: [],
  },
  format: 'json',
})
```

#### Skill instructions

Override or augment skill behavior per-run without editing the skill files:

```typescript
// Tell the deep-research skill to only use specific sources
const result = await agent.run({
  prompt: 'Research the environmental impact of lithium mining',
  skills: ['deep-research'],
  skillInstructions: {
    'deep-research': 'Only use peer-reviewed sources: Google Scholar, PubMed, Nature, Science Direct. Ignore news articles and blog posts.',
  },
})
```

```typescript
// Customize e-commerce extraction for a specific use case
const result = await agent.run({
  prompt: 'Get all running shoes under $150 from Nike.com',
  urls: ['https://www.nike.com/w/running-shoes'],
  skills: ['e-commerce'],
  skillInstructions: {
    'e-commerce': 'Only extract shoes priced under $150. Include colorways available. Skip kids sizes.',
  },
})
```

#### Export skill

Turn any run into a reusable skill:

```typescript
// Run a task and export it as a repeatable workflow
const result = await agent.run({
  prompt: 'Get the top 10 trending repositories on GitHub',
  urls: ['https://github.com/trending'],
  exportSkill: true,
})

// result.exportedSkill contains:
// - name: 'github-trending'
// - skillMd: full SKILL.md with self-healing instructions
// - workflow: deterministic Node.js script using @mendable/firecrawl-js
// - schema: JSON schema for validating the output
console.log(result.exportedSkill.name)      // 'github-trending'
console.log(result.exportedSkill.workflow)   // #!/usr/bin/env node ...
```

```typescript
// Export a complex multi-step workflow as a skill, then save it
const result = await agent.run({
  prompt: 'Get YC batch W25 companies with their funding and team size from HN and Crunchbase',
  exportSkill: true,
  format: 'json',
  schema: {
    companies: [{ name: '', url: '', funding: '', teamSize: null, sources: [] }],
  },
})

// Save the exported skill to your skills directory
if (result.exportedSkill) {
  const dir = `./skills/${result.exportedSkill.name}`
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(`${dir}/SKILL.md`, result.exportedSkill.skillMd)
  fs.writeFileSync(`${dir}/workflow.mjs`, result.exportedSkill.workflow)
  fs.writeFileSync(`${dir}/schema.json`, result.exportedSkill.schema)
}
// Next time: agent.run({ prompt: '...', skills: ['yc-w25-companies'] })
```

```typescript
// Monitor a page on a schedule — export once, run the script directly after
const result = await agent.run({
  prompt: 'Track the price of RTX 5090 on Newegg, Best Buy, and Amazon',
  exportSkill: true,
})

// The workflow.mjs can now run standalone without the agent:
// FIRECRAWL_API_KEY=fc-... node workflow.mjs
// Exit 0 = data collected, exit 1 = partial, exit 2 = stale URLs (re-run agent)
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

```mermaid
graph TD
    subgraph "agent-core"
        CA["createAgent()"] --> ORC[Orchestrator]
        ORC --> SK[Skills Engine]
        ORC --> WK["spawnAgents (parallel workers)"]
        ORC --> SA[Sub-Agents]
        ORC --> OUT[formatOutput + bashExec]
        SK --> SKM[SKILL.md files]
        SK --> PB[Site playbooks]
        SA --> SAI[Per-agent model + instructions]
        SA --> SAT[Scoped tools + skills]
        WK --> W1[Worker]
        WK --> W2[Worker]
        WK --> W3[Worker]
    end

    subgraph "firecrawl-aisdk"
        FT[FirecrawlTools] --> SEARCH[search]
        FT --> SCRAPE[scrape]
        FT --> INTERACT[interact]
        FT --> MAP[map]
    end

    subgraph "Vercel AI SDK"
        TLA[ToolLoopAgent]
        RM[resolveModel]
    end

    ORC -- "tools" --> FT
    ORC -- "extends" --> TLA
    CA -- "multi-provider" --> RM

    style CA fill:#ff6b35,stroke:#c44d1a,color:#fff
    style ORC fill:#ff6b35,stroke:#c44d1a,color:#fff
    style FT fill:#1a1a2e,stroke:#16213e,color:#fff
    style TLA fill:#000,stroke:#333,color:#fff
    style RM fill:#000,stroke:#333,color:#fff
```

Agent-core wraps two packages into an opinionated agent framework:

**[firecrawl-aisdk](https://www.npmjs.com/package/firecrawl-aisdk)** provides the web tools — search, scrape, interact (browser automation), and map. Agent-core consumes these as a toolkit and passes them to the orchestrator and workers.

**[Vercel AI SDK](https://sdk.vercel.ai/)** provides the agent loop (`ToolLoopAgent`) and multi-provider model resolution. Agent-core extends this with:

- **Skills** — SKILL.md files that teach the agent domain-specific procedures (how to navigate a site, what to extract, how to paginate). Site playbooks are auto-matched by URL.
- **Parallel workers** — `spawnAgents` fans out 2+ independent tasks across concurrent worker agents, each with their own context and tools.
- **Sub-agents** — named agents with their own model, instructions, tool scope, and pre-loaded skills. Defined per-run or in config.
- **Output** — `formatOutput` for structured JSON/CSV/markdown, `bashExec` for data processing with jq/awk/sed.
- **Context compaction** — automatic summarization when approaching token limits, so long research sessions don't truncate.

## OpenAPI spec

[`openapi.yaml`](./openapi.yaml) describes the HTTP API. All [templates](../agent-templates/) implement it, all [SDKs](../agent-sdks/) are generated from it.

### API examples

All features available in the library are also available via the HTTP API:

**Sub-agents via API:**

```bash
curl -X POST http://localhost:3000/v1/run \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Compare Vercel and Netlify pricing",
    "subAgents": [
      {
        "id": "vercel",
        "name": "Vercel Researcher",
        "description": "Extract Vercel pricing tiers",
        "instructions": "Go directly to vercel.com/pricing. Extract every tier with price and limits.",
        "tools": ["scrape"],
        "skills": ["price-tracker"],
        "maxSteps": 12
      },
      {
        "id": "netlify",
        "name": "Netlify Researcher",
        "description": "Extract Netlify pricing tiers",
        "instructions": "Go directly to netlify.com/pricing. Extract every tier with price and limits.",
        "tools": ["scrape"],
        "skills": ["price-tracker"],
        "maxSteps": 12
      }
    ],
    "format": "json"
  }'
```

**Export skill via API:**

```bash
curl -X POST http://localhost:3000/v1/run \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Get the top Show HN posts from Hacker News",
    "urls": ["https://news.ycombinator.com/show"],
    "exportSkill": true
  }'

# Response includes exportedSkill with name, skillMd, workflow, and schema
```

**Skill instructions via API:**

```bash
curl -X POST http://localhost:3000/v1/run \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Research LLM pricing across providers",
    "skills": ["deep-research"],
    "skillInstructions": {
      "deep-research": "Only use official pricing pages. No blog posts or third-party comparisons."
    },
    "format": "json"
  }'
```

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
