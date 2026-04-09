# Next.js Template

Full-featured web app with chat UI, real-time agent visualization, and structured data export.

## Install

```bash
firecrawl-agent init my-agent -t next
```

Or manually:

```bash
npm install
cp .env.local.example .env.local   # add your FIRECRAWL_API_KEY
npm run dev                         # http://localhost:3000
```

## Features

- **Chat interface** - streaming responses with real-time tool call visualization
- **Plan visualization** - mermaid flowcharts showing the agent's research plan
- **Parallel agent tracking** - live progress for each worker with browser view when using interact
- **Structured output** - JSON viewer, CSV table, markdown renderer with download
- **Save as Skill** - generate a reusable SKILL.md from any successful conversation
- **Model selector** - switch between providers and models from the UI (BYOK - Bring Your Own Key)
- **Settings panel** - configure API keys, default provider, custom OpenAI-compatible endpoints
- **File upload** - upload CSV, JSON, or text files for the agent to process

## Configuration

All config lives in `app/(agent)/_config.ts`:

```typescript
export const config = {
  // Pick your provider - uncomment one block
  orchestrator: { provider: "anthropic", model: "claude-sonnet-4-6" },
  subAgent:     { provider: "anthropic", model: "claude-sonnet-4-6" },
  background:   { provider: "anthropic", model: "claude-haiku-4-5-20251001" },

  maxWorkers: 6,         // max concurrent parallel agents
  workerMaxSteps: 10,    // max steps per worker

  // Task-specific model overrides (null = use background model)
  tasks: {
    plan: null,             // execution plan generation
    suggestions: null,      // follow-up suggestions
    skillGeneration: null,  // SKILL.md generation
    query: null,            // /api/query endpoint
    extract: null,          // /api/extract endpoint
  },

  experimental: {
    customOpenAI: true,     // show custom OpenAI-compatible provider in Settings
    generateSkillMd: true,  // show Save as Skill button
  },

  history: {
    enabled: false,  // enable SQLite conversation history
  },
};
```

## API Endpoints

The template exposes the same API as the Express template, plus UI-specific routes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent` | POST | Main agent endpoint (AI SDK streaming) |
| `/api/v1/run` | POST | REST API - same as Express template |
| `/api/query` | POST | Simple text query, returns text |
| `/api/extract` | POST | Extract structured data with a schema |
| `/api/plan` | POST | Generate an execution plan without running |
| `/api/skills` | GET | List available skills |
| `/api/skills/generate` | POST | Generate SKILL.md from conversation (streamed) |
| `/api/config` | GET | Current model and provider config |
| `/api/files` | GET | List files in the bash sandbox |
| `/api/workers/progress` | GET | Live progress for parallel workers |

## Environment variables

```
FIRECRAWL_API_KEY=fc-...            # required
ANTHROPIC_API_KEY=...               # at least one model provider
OPENAI_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
AI_GATEWAY_API_KEY=...
```

## Project structure

```
app/(agent)/
├── _config.ts              # all model + feature config
├── _lib/
│   ├── config/keys.ts      # API key resolution + hydration
│   └── config/models.ts    # available models per provider
├── _components/
│   ├── plan-visualization   # tool call timeline + worker cards
│   ├── artifact-panel       # JSON/CSV/markdown viewer + Save as Skill
│   ├── agent-input          # chat input with file upload
│   ├── model-selector       # provider + model picker
│   ├── settings-panel       # API keys + custom OpenAI config
│   └── sidebar              # conversation history + file assets
├── api/
│   ├── agent/               # main agent streaming endpoint
│   ├── v1/run/              # REST API
│   ├── skills/generate/     # SKILL.md generation (SSE stream)
│   └── workers/progress/    # worker progress polling
└── page.tsx                 # main chat page
```

## Deploy

```bash
firecrawl-agent deploy -p vercel    # generates vercel.json
firecrawl-agent deploy -p railway   # generates railway.toml
firecrawl-agent deploy -p docker    # generates Dockerfile
```
