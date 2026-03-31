# Firecrawl Agent

AI-powered web research agent. Search, scrape, and extract structured data from any website.

Built on the [Vercel AI SDK](https://sdk.vercel.ai/) and [Firecrawl](https://firecrawl.dev/).

## Quick start

```bash
git clone https://github.com/nicholasgriffintn/firecrawl-agent.git
cd firecrawl-agent
npm install
cp .env.local.example .env.local   # add your FIRECRAWL_API_KEY
npm run dev                         # http://localhost:3000
```

Then call it:

```bash
curl -X POST http://localhost:3000/api/v1/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Get the top 5 stories on Hacker News with title and points"}'
```

## What it does

You give it a prompt. It searches the web, scrapes pages, extracts data, and returns structured results.

```
"Compare pricing for Vercel, Netlify, and Cloudflare Pages"

  -> Searches for each provider's pricing page
  -> Scrapes all three in parallel
  -> Extracts plan tiers, prices, features
  -> Returns a comparison table with sources
```

## How it works

```mermaid
graph LR
    A[Prompt] --> B[Agent Core]
    B --> C[Search]
    B --> D[Scrape]
    B --> E[Interact]
    B --> F[Bash Sandbox]
    C --> G[Results]
    D --> G
    E --> G
    F --> G
```

The agent receives a prompt, plans its approach, then uses Firecrawl tools to gather data from the web. For complex tasks it spawns parallel workers that run independently and report back.

```mermaid
graph TD
    A[Orchestrator] --> B{Parallel?}
    B -->|Yes| C[Worker 1: Vercel]
    B -->|Yes| D[Worker 2: Netlify]
    B -->|Yes| E[Worker 3: Cloudflare]
    C --> F[Compile Results]
    D --> F
    E --> F
    F --> G[Formatted Output]
    B -->|No| H[Sequential Steps]
    H --> G
```

## Architecture

```mermaid
graph TD
    subgraph "Agent Core (TypeScript)"
        ORC[Orchestrator]
        ORC --> TOOLS[Firecrawl Tools]
        ORC --> SKILLS[Skills]
        ORC --> WORKERS[Parallel Workers]
        ORC --> BASH[Bash Sandbox]
        ORC --> SUBS[Sub-Agents]
    end

    subgraph "Server Templates"
        NEXT[Next.js - Full UI]
        HONO[Hono - API Only]
        EXPRESS[Express - API Only]
    end

    NEXT --> ORC
    HONO --> ORC
    EXPRESS --> ORC

    subgraph "Clients (any language)"
        PY[Python SDK]
        GO[Go SDK]
        JS[JS/TS SDK]
        MORE[+ 14 more]
    end

    PY -->|POST /v1/run| NEXT
    GO -->|POST /v1/run| HONO
    JS -->|POST /v1/run| EXPRESS
    MORE -->|POST /v1/run| NEXT
```

## Repository structure

```
agent-core/        Core agent logic, OpenAPI spec
templates/         Server templates (Next.js, Hono, Express)
sdks/              Auto-generated clients for 17 languages
examples/          Working examples for every language
deploy/            Platform configs (Vercel, Railway, Docker)
scripts/           SDK generation and testing tools
```

| Directory | README | What you'll find |
|-----------|--------|-----------------|
| [agent-core/](./agent-core/) | [README](./agent-core/README.md) | `createAgent()` API, architecture, configuration |
| [templates/](./templates/) | [README](./templates/README.md) | Next.js (full UI), Hono (API-only), Express |
| [sdks/](./sdks/) | [README](./sdks/README.md) | Python, Go, JS, Ruby, Java, Rust, and 11 more |
| [examples/](./examples/) | [README](./examples/README.md) | 17 working examples with run commands |
| [deploy/](./deploy/) | [README](./deploy/README.md) | Vercel, Railway, Docker, Cloudflare |

## Two ways to use the agent

**As an API (any language)** -- deploy the server, call `POST /v1/run` from anywhere.

```python
# Python
import requests
result = requests.post("https://your-agent.example.com/api/v1/run", json={
    "prompt": "Get pricing for Vercel",
    "format": "json"
}).json()
```

```go
// Go
body, _ := json.Marshal(map[string]any{"prompt": "Get pricing for Vercel"})
resp, _ := http.Post("https://your-agent.example.com/api/v1/run", "application/json", bytes.NewReader(body))
```

**As a TypeScript library (direct import)** -- no server needed, agent runs in-process.

```typescript
import { createAgent } from '@firecrawl/agent-core'

const agent = createAgent({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  model: { provider: 'google', model: 'gemini-3-flash-preview' },
})

const result = await agent.run({ prompt: 'Get pricing for Vercel' })
```

## API

Single endpoint. Full spec at [agent-core/openapi.yaml](./agent-core/openapi.yaml).

```
POST /v1/run
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string | The research task (required) |
| `format` | `json` \| `csv` \| `markdown` | Output format |
| `schema` | object | JSON schema for structured extraction |
| `urls` | string[] | Seed URLs to start from |
| `maxSteps` | number | Max agent steps (default: 15) |
| `stream` | boolean | SSE streaming mode |
| `skills` | string[] | Skills to pre-load |
| `model` | object | `{ provider, model }` override |

## Configuration

Edit `config.ts` to change models, worker limits, and pricing:

```typescript
export const config = {
  orchestrator: { provider: "google", model: "gemini-3-flash-preview" },
  subAgent:     { provider: "google", model: "gemini-3-flash-preview" },
  maxWorkers: 6,
  workerMaxSteps: 10,
}
```

Supported providers: Google (Gemini), Anthropic (Claude), OpenAI (GPT).

## Skills

The agent discovers skills from `.agents/skills/`. Each skill is a markdown file that teaches the agent domain-specific knowledge (pricing analysis, SEO audits, data extraction patterns).

```
.agents/skills/
  price-tracker/SKILL.md
  seo-audit/SKILL.md
  company-research/SKILL.md
  ...
```

See [agent-core/README.md](./agent-core/README.md) for details.

## For AI agents

If you're an AI agent reading this repository:

- **Understand the system**: read [agent-core/README.md](./agent-core/README.md)
- **API specification**: read [agent-core/openapi.yaml](./agent-core/openapi.yaml)
- **Run it**: `npm install && npm run dev`
- **Call it**: `POST /api/v1/run` with `{"prompt": "your task"}`
- **Configuration**: [config.ts](./config.ts) for models, [.env.local.example](./.env.local.example) for API keys
- **Server options**: [templates/](./templates/) for Hono/Express alternatives
- **Deploy it**: [deploy/](./deploy/) for platform-specific configs

## License

MIT
