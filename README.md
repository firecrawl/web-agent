# Firecrawl Agent

<img src=".internal/agent.jpg" alt="Firecrawl Agent" />

When we built [Firecrawl's /agent endpoint](https://docs.firecrawl.dev/features/agent), the most common request was more control. People wanted to customize the agent, swap models, add their own skills, and build on top of the core primitives.

So we're open-sourcing the entire stack. One command scaffolds an agent at whatever level of abstraction you want to work with. Everything in this repo is yours to fork, extend, and deploy however you want.

Firecrawl's hosted [/agent](https://firecrawl.dev/app/agent) and [Spark 1](https://docs.firecrawl.dev/features/models) models are optimized for structured web research out of the box. This repo gives you the same capabilities with full control over every layer.

## Hosted

> **[firecrawl.dev/app/agent](https://firecrawl.dev/app/agent)** - Powered by Firecrawl [Spark 1](https://docs.firecrawl.dev/features/models) models. No setup, no config, no API keys to manage. [Docs](https://docs.firecrawl.dev/features/agent)

## Open Source

Each layer builds on the one below it. Start at the top for a ready-to-use app, or go lower in the stack for finer control over the primitives.

| Layer | Description | Get started |
|:---:|---|---|
| [**Next.js Template**](./agent-templates/next/) | Chat UI, streaming, skills, sub-agents, structured output | `firecrawl-agent init -t next` |
| [**Express Template**](./agent-templates/express/) | API server with skills, sub-agents, structured output | `firecrawl-agent init -t express` |
| ↑ | | |
| [**Agent Core**](./agent-core/) | Orchestrator, skills, sub-agents, structured output | `firecrawl-agent init -t library` |
| ↑ | | |
| [**Firecrawl AI SDK**](https://npmjs.com/package/firecrawl-aisdk) | search, scrape, interact as Vercel AI SDK tools | `npm i firecrawl-aisdk` |
| ↑ | | |
| [**Firecrawl SDK**](https://npmjs.com/package/firecrawl) | Core API client for scrape, search, crawl, extract | `npm i firecrawl` |
| ↑ | | |
| [**API Reference**](https://docs.firecrawl.dev/api-reference/v2-introduction) | REST API, use from any language | [docs.firecrawl.dev](https://docs.firecrawl.dev) |

### Examples

**Agent Core** ([all examples](./agent-core/examples/))

1. [Basic usage](./agent-core/examples/1-basic.ts) - single prompt, text response
2. [Structured output](./agent-core/examples/2-structured-output.ts) - enforce a JSON schema
3. [Parallel sub-agents](./agent-core/examples/3-parallel-subagents.ts) - multiple sites concurrently
4. [With skills](./agent-core/examples/4-with-skills.ts) - load a reusable skill
5. [Streaming](./agent-core/examples/5-streaming.ts) - get results as they arrive

**Templates**

- [Next.js](./agent-templates/next/) - full web app with chat UI
- [Express](./agent-templates/express/) - API server with `POST /v1/run`

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
