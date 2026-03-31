# Templates

Server templates for running the Firecrawl Agent. Each wraps `agent-core` with a different framework.

## Comparison

| Template | Framework | Lines | UI | Best for |
|----------|-----------|-------|----|----------|
| [next](./next/) | Next.js | Full app | Yes | Complete experience — chat UI, history, settings |
| [hono](./hono/) | Hono | ~90 | No | Lightweight API. Fast cold starts, serverless-friendly |
| [express](./express/) | Express | ~70 | No | Familiar Node.js framework. Middleware ecosystem |

## How they relate to agent-core

All templates import from `agent-core/`. The core agent logic — orchestration, tools, skills, prompts — is identical across templates. Templates only differ in how the HTTP layer is set up.

```
agent-core/     ← shared brain
  ├── templates/next/       ← Full UI + API
  ├── templates/hono/       ← API only (Hono)
  └── templates/express/    ← API only (Express)
```

## API compatibility

All templates expose the same `POST /v1/run` endpoint described in `agent-core/openapi.yaml`. SDKs and examples work with any template.
