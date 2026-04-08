# Firecrawl Agent

Web research agent built on Vercel AI SDK + Firecrawl. The agent searches, scrapes, and extracts structured data from any website.

## Stack

- **Agent loop**: Vercel AI SDK `ToolLoopAgent` (in `agent-core/src/orchestrator/index.ts`)
- **Web tools**: Firecrawl SDK — search, scrape, interact, map, crawl, extract
- **Skills**: Reusable `.md` playbooks in `agent-core/src/skills/definitions/`
- **Prompts**: Core behavior in `agent-core/src/orchestrator/prompts/`, app-specific in `prompts/`
- **Models**: Anthropic, OpenAI, Google (resolved in `agent-core/src/resolve-model.ts`)

## Key Files

| File | What it does |
|------|-------------|
| `agent-core/src/agent.ts` | `createAgent()` — the public API. `.run()`, `.stream()`, `.toResponse()` |
| `agent-core/src/orchestrator/index.ts` | Assembles model + tools + prompts → `ToolLoopAgent` |
| `agent-core/src/orchestrator/prompts/system.md` | Core system prompt — edit to change agent behavior |
| `agent-core/src/tools.ts` | `formatOutput`, `bashExec`, `exportSkill` tools |
| `agent-core/src/skills/definitions/` | Built-in skills. Add folders with SKILL.md files |
| `prompts/` | App-specific prompts passed via `appSections` |

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # start production server
```

## How to Modify

- **Agent behavior**: edit `agent-core/src/orchestrator/prompts/system.md`
- **App behavior**: edit `prompts/*.md` (planning, presentation, workflow examples)
- **Add a skill**: create `agent-core/src/skills/definitions/{name}/SKILL.md`
- **Add a tool**: add in `agent-core/src/tools.ts`, register in `agent-core/src/orchestrator/index.ts`
- **Swap model**: change `MODEL_PROVIDER` and `MODEL_ID` in `.env.local`
- **Add app prompts**: add `.md` files to `prompts/`, load in `prompts/loader.ts`

## API

All templates expose `POST /api/v1/run`:

```json
{
  "prompt": "Compare pricing for Vercel vs Netlify",
  "stream": true,
  "format": "json",
  "schema": { "type": "array", "items": { "type": "object" } }
}
```

## Architecture

```
createAgent({ firecrawlApiKey, model, appSections })
  → resolves model (anthropic/openai/google)
  → builds tools (firecrawl + skills + workers + formatOutput + exportSkill)
  → loads prompts (core + app sections)
  → new ToolLoopAgent({ model, instructions, tools })
  → agent loop: think → tool call → observe → repeat
```

Prompts are `.md` files. Tools are AI SDK `tool()` definitions. Skills are auto-discovered SKILL.md files. Everything is yours to modify.
