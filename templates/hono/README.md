# firecrawl-agent hono template

Lightweight API server wrapping agent-core. No UI -- just `POST /v1/run` and `GET /v1/skills`.

## Setup

```bash
cd templates/hono
npm install

# Required
export FIRECRAWL_API_KEY=fc-...

# At least one model provider key
export GOOGLE_GENERATIVE_AI_KEY=...
# or
export ANTHROPIC_API_KEY=...
# or
export OPENAI_API_KEY=...

npm run dev
```

Server starts on `http://localhost:3000` (override with `PORT`).

## Model selection

Set `MODEL_PROVIDER` and `MODEL_ID` env vars, or pass `model` in the request body. Defaults to `google` / `gemini-2.5-flash-preview-05-20`.

## Endpoints

### POST /v1/run

Run the agent. Supports streaming (SSE) and non-streaming responses.

```bash
# Non-streaming
curl -X POST http://localhost:3000/v1/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "get pricing tiers from vercel.com"}'

# Streaming
curl -N -X POST http://localhost:3000/v1/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "get pricing tiers from vercel.com", "stream": true}'

# With format + schema
curl -X POST http://localhost:3000/v1/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "get pricing tiers from vercel.com",
    "format": "json",
    "schema": {"tiers": [{"name": "string", "price": "string"}]}
  }'
```

**Body fields:** `prompt` (required), `stream`, `format` (`json`|`csv`|`markdown`), `schema`, `columns`, `urls`, `model`, `maxSteps`, `skills`.

### GET /v1/skills

List available skills from `.agents/skills/`.

```bash
curl http://localhost:3000/v1/skills
```
