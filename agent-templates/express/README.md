# Express Template

Node.js API server with `POST /v1/run` endpoint powered by [agent-core](../../agent-core/).

## Install

```bash
firecrawl-agent init my-agent -t express
```

Or manually:

```bash
npm install
npm run dev
```

## Environment variables

Create a `.env` file:

```
FIRECRAWL_API_KEY=fc-...            # required
ANTHROPIC_API_KEY=...               # at least one model provider
OPENAI_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
MODEL_PROVIDER=anthropic            # default provider
MODEL_ID=claude-sonnet-4-6          # default model
PORT=3000
```

## API

### POST /v1/run

```bash
curl -X POST http://localhost:3000/v1/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Get pricing for Vercel", "format": "json"}'
```

**Parameters:** `prompt` (required), `stream`, `format` (`json` | `csv` | `markdown`), `schema`, `urls`, `skills`, `maxSteps`.

**Streaming:** set `"stream": true` for Server-Sent Events with tool calls and results as they happen.

## Examples

```bash
npm run example:basic        # single prompt
npm run example:structured   # JSON schema output
npm run example:parallel     # parallel Subagents
npm run example:skills       # load a Skill
npm run example:stream       # streaming output
```
