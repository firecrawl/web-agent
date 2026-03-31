# Firecrawl Agent - Express Template

Standalone Express server wrapping `agent-core` with a single `POST /v1/run` endpoint.

## Setup

```bash
npm install
```

Create a `.env` file (or export the variables):

```
FIRECRAWL_API_KEY=fc-...
GOOGLE_GENERATIVE_AI_API_KEY=...   # default provider
# ANTHROPIC_API_KEY=...            # optional
# OPENAI_API_KEY=...               # optional
# PORT=3000                        # optional
```

## Run

```bash
npm run dev    # watch mode
npm start      # production
```

## Endpoints

### POST /v1/run

Run the agent. Supports streaming (SSE) and non-streaming responses.

```json
{
  "prompt": "Get pricing for Vercel, Netlify, and Cloudflare Pages",
  "stream": false,
  "format": "json",
  "schema": {},
  "columns": [],
  "urls": [],
  "model": { "provider": "google", "model": "gemini-2.5-flash-preview-05-20" },
  "maxSteps": 15,
  "skills": []
}
```

Set `"stream": true` for Server-Sent Events.

### GET /v1/skills

Returns available skills.
