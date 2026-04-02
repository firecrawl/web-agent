# Templates

Server templates for running the Firecrawl Agent. Each wraps [agent-core](../agent-core/) with a different framework.

## Install

```bash
firecrawl-agent init my-agent -t <template>
```

## Templates

| Template | Framework | UI | Best for |
|----------|-----------|-----|----------|
| [**next**](./next/) | Next.js | Full app | Chat UI, history, settings, visualization |
| [**express**](./express/) | Express | API only | Backend services, self-hosted |
| [**hono**](./hono/) | Hono | API only | Serverless, edge, fast cold starts |

## How they work

All templates import from [agent-core](../agent-core/). The core logic — orchestration, tools, skills — is identical. Templates only differ in the HTTP layer.

All expose the same `POST /v1/run` endpoint described in the [OpenAPI spec](../agent-core/openapi.yaml). Any [SDK](../sdks/) or [example](../examples/) works with any template.

## Deploy

```bash
firecrawl-agent deploy -p vercel     # Next.js, Hono
firecrawl-agent deploy -p railway    # any template
firecrawl-agent deploy -p docker     # any template
```

The CLI auto-detects your framework and generates the right config.
