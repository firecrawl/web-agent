# Firecrawl Agent

<img src=".internal/agent.jpg" alt="Firecrawl Agent" />

AI-powered web research agent built on [Firecrawl](https://firecrawl.dev). Give it a prompt - it searches, scrapes, and extracts structured data from any website.

## Choose your level

|  | [Firecrawl AI SDK](https://npmjs.com/package/firecrawl-aisdk) | [Agent Core](./agent-core/) | [Templates](./agent-templates/) |
|---|---|---|---|
| **What it is** | Vercel AI SDK tools for search, scrape, interact | Orchestrator + skills + sub-agents + structured output | Full apps with UI, streaming, config |
| **Best for** | Drop Firecrawl into any existing AI app | Custom agents with parallel workers and reusable skills | Ship a complete agent product |
| **Install** | `npm i firecrawl-aisdk` | `npm i @firecrawl/agent-core` | `firecrawl-agent init my-app` |
| **Skills** | Manual | Built-in | Built-in |
| **Sub-agents** | Manual | Built-in | Built-in |
| **Structured output** | Manual | Built-in (JSON, CSV, Markdown) | Built-in (JSON, CSV, Markdown) |
| **Chat UI** | BYO | BYO | Included (Next.js) |

---

### 1. Firecrawl AI SDK

The lightest option. Add Firecrawl's web tools to any Vercel AI SDK agent:

```typescript
import { generateText, stepCountIs } from 'ai'
import { FirecrawlTools } from 'firecrawl-aisdk'

const { text } = await generateText({
  model: anthropic('claude-sonnet-4-6'),
  tools: FirecrawlTools(),
  stopWhen: stepCountIs(30),
  prompt: `
    1. Use interact on Hacker News to identify the top story
    2. Search for other perspectives on the same topic
    3. Scrape the most relevant pages you found
    4. Summarize everything you found
  `,
})

console.log(text)
```

You control the model, the loop, everything. `FirecrawlTools()` gives you `search`, `scrape`, and `interact` as standard AI SDK tools.

[npm](https://npmjs.com/package/firecrawl-aisdk)

---

### 2. Agent Core

Adds an opinionated orchestrator on top: plans work, parallelizes with sub-agents, loads reusable skills, and outputs structured data.

```typescript
import { createAgent } from '@firecrawl/agent-core'

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
})

const result = await agent.run({
  prompt: 'Get the P/E ratio and stock price for NVIDIA, Google, and Microsoft',
  schema: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        company: { type: 'string' },
        ticker: { type: 'string' },
        price: { type: 'number' },
        peRatio: { type: 'number' },
      },
    },
  },
})

console.log(result.output) // structured JSON matching your schema
```

What you get on top of the AI SDK:
- **Parallel sub-agents** - NVIDIA, Google, Microsoft scraped concurrently
- **Skills** - reusable SKILL.md playbooks loaded on demand
- **Schema enforcement** - output matches your schema exactly
- **Context compaction** - long sessions stay within the context window

---

### 3. Templates

Scaffold a complete project with UI, streaming, and configuration:

```bash
firecrawl-agent init my-agent
```

```
? Template
> Next.js (Full UI)      Complete web app with chat UI, streaming, skills
  Express (API only)     Lightweight Node.js API server with /v1/run endpoint
```

| Template | Install | What you get |
|----------|---------|-------------|
| [**Next.js**](./agent-templates/next/) | `firecrawl-agent init my-agent -t next` | Full web app with chat UI, streaming, skills |
| [**Express**](./agent-templates/express/) | `firecrawl-agent init my-agent -t express` | Lightweight API server with `POST /v1/run` |

Both templates build on agent-core and include all its features out of the box.

---

## How it works

The agent combines web tools with an AI model in a loop - it plans, acts, observes, and repeats until the task is done.

- **Tools** - search, scrape, interact (browser automation). Powered by [firecrawl-aisdk](https://www.npmjs.com/package/firecrawl-aisdk).
- **Skills** - reusable SKILL.md files that teach the agent site-specific procedures. Auto-discovered at startup.
- **Sub-agents** - parallel workers for independent tasks. The orchestrator spawns them dynamically.
- **Output** - structured results via `formatOutput` (JSON, CSV, Markdown) and data processing via `bashExec`.

## Project structure

| Directory | What's inside |
|-----------|--------------|
| [`agent-core/`](./agent-core/) | Core agent logic, orchestrator, skills, tools |
| [`agent-templates/`](./agent-templates/) | Server templates - [Next.js](./agent-templates/next/), [Express](./agent-templates/express/) |
| [`.internal/cli/`](./.internal/cli/) | CLI tool - `init`, `dev`, `deploy` |

## License

MIT
