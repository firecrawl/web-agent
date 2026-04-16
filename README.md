# Firecrawl Agent

[![CI](https://github.com/firecrawl/firecrawl-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/firecrawl/firecrawl-agent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

<img src=".internal/agent.jpg" alt="Firecrawl Agent" />

<img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWhub2Jmd3NvejdhaTFsb3RvZWtpb2Q3cDVpN2pzYjVqeTgxdDEwbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/CVyWVobjHwYGJiRz6r/giphy.gif" alt="Firecrawl Agent Demo" width="100%" />

Firecrawl runs a research-grade autonomous agent at [firecrawl.dev/app/agent](https://firecrawl.dev/app/agent), powered by [Spark 1](https://docs.firecrawl.dev/features/models) models optimized for structured web research. This repo gives you the open-source foundation to build your own — fork it, swap models, add skills, and deploy however you want.

## Get started

```bash
# 1. Install the Firecrawl CLI and authenticate
npx -y firecrawl-cli@latest init -y --browser

# 2. Scaffold an agent project
firecrawl create agent -t next
```

## Hosted

> **[firecrawl.dev/app/agent](https://firecrawl.dev/app/agent)** - Powered by Firecrawl [Spark 1](https://docs.firecrawl.dev/features/models) models. No setup, no config, no API keys to manage. [Docs](https://docs.firecrawl.dev/features/agent)

## Open Source

Each layer builds on the one below it. Start at the top for a ready-to-use app, or go lower in the stack for finer control over the primitives.

| Layer | Description | Get started |
|:---:|---|---|
| [**Next.js Template**](./agent-templates/next/) | Chat UI, streaming, Skills, Subagents, structured output | `firecrawl create agent -t next` |
| [**Express Template**](./agent-templates/express/) | API server with Skills, Subagents, structured output | `firecrawl create agent -t express` |
| ↑ | | |
| [**Agent Core**](./agent-core/) | Orchestrator built on [Deep Agents](https://docs.langchain.com/oss/javascript/deepagents/overview) (LangChain). Skills, Subagents, structured output | `firecrawl create agent -t library` |
| ↑ | | |
| [**Firecrawl AI SDK**](https://npmjs.com/package/firecrawl-aisdk) | Search, Scrape, Interact as Vercel AI SDK tools | `npm i firecrawl-aisdk` |
| ↑ | | |
| [**Firecrawl SDK**](https://www.npmjs.com/package/@mendable/firecrawl-js) | Core API client for Scrape, Search, Crawl, Extract | `npm i @mendable/firecrawl-js` |
| ↑ | | |
| [**API Reference**](https://docs.firecrawl.dev/api-reference/v2-introduction) | REST API, use from any language | [docs.firecrawl.dev](https://docs.firecrawl.dev) |

### Examples

| Level | Examples |
|---|---|
| Next.js | [Full template](./agent-templates/next/) |
| Express | [API server](./agent-templates/express/) |
| Agent Core | [Basic](./agent-core/examples/1-basic.ts) · [Structured output](./agent-core/examples/2-structured-output.ts) · [Parallel Subagents](./agent-core/examples/3-parallel-subagents.ts) · [With Skills](./agent-core/examples/4-with-skills.ts) · [Streaming](./agent-core/examples/5-streaming.ts) |
| Firecrawl AI SDK | [npmjs.com/package/firecrawl-aisdk](https://npmjs.com/package/firecrawl-aisdk) |

## How it works

The agent combines web tools with an AI model in a loop — it plans, acts, observes, and repeats until the task is done. The harness is [Deep Agents](https://docs.langchain.com/oss/javascript/deepagents/overview) (from LangChain), which gives us the plan-act loop, parallel `task` sub-agent spawning, and on-demand SKILL.md loading out of the box. Our `agent-core` wires Firecrawl's tools into that runtime and layers on structured output and a streaming UIs.

- **Harness** — [Deep Agents](https://docs.langchain.com/oss/javascript/deepagents/overview). Provides the agent loop, sub-agent spawning, skills loading, and context management.
- **Tools** — Search, Scrape, Interact (browser automation), bash. Powered by [firecrawl-aisdk](https://www.npmjs.com/package/firecrawl-aisdk).
- **Skills** — reusable SKILL.md playbooks. Auto-discovered from `agent-core/src/skills/definitions/`, loaded on demand via Deep Agents' skills middleware.
- **Subagents** — parallel workers for independent tasks, spawned via Deep Agents' `task` tool. Each has its own tool set and session state (e.g. an isolated interact browser session).
- **Output** — structured results via `formatOutput` (JSON) and data processing via `bashExec`.

## Project structure

| Directory | What's inside |
|-----------|--------------|
| [`agent-core/`](./agent-core/) | Core agent logic, orchestrator, Skills, tools |
| [`agent-templates/`](./agent-templates/) | Deployment templates - [Next.js](./agent-templates/next/), [Express](./agent-templates/express/), [Library](./agent-templates/library/) |

## License

MIT
