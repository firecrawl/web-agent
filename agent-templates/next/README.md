# Next.js Template

<img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWhub2Jmd3NvejdhaTFsb3RvZWtpb2Q3cDVpN2pzYjVqeTgxdDEwbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/CVyWVobjHwYGJiRz6r/giphy.gif" alt="Firecrawl Agent Demo" width="100%" />

Full-featured web app with chat UI, real-time agent visualization, and structured data export.

## Install

```bash
firecrawl create agent -t next
```

Or manually:

```bash
npm install
cp .env.local.example .env.local   # add your FIRECRAWL_API_KEY
npm run dev                         # http://localhost:3000
```

## Configuration

**`app/(agent)/_config.ts`** is the single file that controls all model selections, agent behavior, and feature flags. Open it first — it's the main thing you'll customize.

```typescript
export const config = {
  // Pick your provider — uncomment one block
  orchestrator: { provider: "anthropic", model: "claude-sonnet-4-6" },
  subAgent:     { provider: "anthropic", model: "claude-sonnet-4-6" },
  background:   { provider: "anthropic", model: "claude-haiku-4-5-20251001" },

  maxWorkers: 10,              // max concurrent parallel agents
  workerMaxSteps: 50,          // max steps per worker

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

Swap providers by uncommenting a different block (Google, OpenAI, or custom OpenAI-compatible). The file also has pricing estimates and helper functions for task-specific model overrides.

## Features

- **Chat interface** — streaming responses with real-time tool call visualization
- **Plan visualization** — mermaid flowcharts showing the agent's research plan
- **Parallel agent tracking** — live progress for each worker with browser view when using interact
- **Structured output** — JSON viewer, markdown renderer with download
- **Save as Skill** — generate a reusable SKILL.md from any successful conversation
- **Model selector** — switch between providers and models from the UI (BYOK - Bring Your Own Key)
- **Settings panel** — configure API keys, default provider, custom OpenAI-compatible endpoints
- **File upload** — upload CSV, JSON, or text files for the agent to process

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
FIRECRAWL_API_KEY=fc-...                # required
GOOGLE_GENERATIVE_AI_API_KEY=AIza...     # or ANTHROPIC_API_KEY / OPENAI_API_KEY
# AI_GATEWAY_API_KEY=...                  # optional
# CUSTOM_OPENAI_API_KEY=...               # optional
# CUSTOM_OPENAI_BASE_URL=...              # optional
```

See `.env.local.example` for all options. Users can also configure keys via the Settings panel at runtime (BYOK).

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

Deploy like any Next.js app:

```bash
# Vercel
vercel deploy

# Railway, Fly, Render, self-hosted
npm run build && npm start
```

> **Vercel note**: `/api/v1/run` and related routes set `maxDuration = 300` (5 minutes). This requires the Pro plan — free tier caps at 10s, Hobby at 60s. For shorter deploys, reduce `maxDuration` in the route files or use a non-Vercel host.

### Vercel / `agent-core`

This app vendors **`agent-core/`** (a copy of the shared package). Imports go through `agent-core.ts` → `./agent-core/src`.

**Refresh the copy** after upstream `agent-core` changes (from monorepo root):

```bash
# from firecrawl-agent repo root
node .internal/scripts/sync-agent-core.mjs
# optional: preview under /tmp only
node .internal/scripts/sync-agent-core.mjs --tmp
```

**Standalone Git repo:** commit the `agent-core/` directory as part of your project (run the sync script once against upstream, or copy the folder).

The build runs `node scripts/verify-agent-core.mjs` first so a missing `agent-core` fails with a clear message.
