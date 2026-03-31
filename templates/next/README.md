# Next.js Template

Full-featured web app with UI, conversation history, file management, and real-time agent activity visualization.

This is the default template — the root of this repository IS the Next.js app.

## What's included

- Complete web UI with chat interface
- Real-time streaming with tool call visualization
- Parallel agent progress tracking
- Conversation history (SQLite)
- File upload and bash sandbox
- Settings panel for API keys and model selection
- Mermaid plan visualization
- Export to JSON, CSV, Markdown

## Setup

```bash
npm install
cp .env.local.example .env.local
# Add your FIRECRAWL_API_KEY and model provider keys to .env.local
npm run dev
```

## Project structure

```
/ (repository root)
  app/              — Next.js app router (pages + API routes)
  components/       — React components
  styles/           — CSS and design system
  config.ts         — Model and agent configuration
  lib/              — Next.js-specific code (keys, db, models)
  agent-core/       — Core agent logic (shared with all templates)
```

## Key files

| File | Purpose |
|------|---------|
| `config.ts` | Model selection, worker limits, pricing |
| `app/api/v1/run/route.ts` | Consolidated API endpoint (OpenAPI-compatible) |
| `app/api/agent/route.ts` | UI streaming endpoint (AI SDK chat protocol) |
| `app/page.tsx` | Main chat interface |
| `lib/config/keys.ts` | API key management |
| `lib/db.ts` | SQLite conversation storage |

## When to use this template

Use Next.js when you want the full experience — UI, history, settings, visualization. For API-only deployments, see the [Hono](../hono/) or [Express](../express/) templates.
