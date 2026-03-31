# curl Examples for /api/v1/run

Three examples showing how to call the firecrawl-agent API with curl.

Base URL: `http://localhost:3000/api/v1`

---

## 1. Simple Query (non-streaming)

Send a plain-text prompt and get a JSON response with the agent's result.

```bash
curl -s http://localhost:3000/api/v1/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is the main product on https://example.com?"
  }'
```

The response is a JSON object containing the agent's output.

---

## 2. Structured JSON Extraction

Use the `format` and `schema` parameters to get structured data back. You can
also pass `urls` to scope the agent to specific pages and `columns` to shape
CSV/table output.

```bash
curl -s http://localhost:3000/api/v1/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Extract the pricing tiers from https://example.com/pricing",
    "format": "json",
    "urls": ["https://example.com/pricing"],
    "schema": {
      "tiers": [
        {
          "name": "string",
          "price": "string",
          "features": ["string"]
        }
      ]
    }
  }'
```

The response body will conform to the schema you provided.

---

## 3. Streaming with SSE

Set `"stream": true` to receive Server-Sent Events. Each event is a
`data:` line containing a JSON object with a `type` field (e.g. `agent_event`,
`result`, `error`).

```bash
curl -N http://localhost:3000/api/v1/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Summarize the homepage of https://example.com",
    "stream": true
  }'
```

`-N` disables output buffering so events print as they arrive.

---

## Request Body Reference

| Field           | Type                         | Default  | Description                                |
|-----------------|------------------------------|----------|--------------------------------------------|
| `prompt`        | string (required)            | --       | The task for the agent to perform          |
| `stream`        | boolean                      | `false`  | Enable SSE streaming                       |
| `format`        | `"json"` / `"csv"` / `"markdown"` | --  | Desired output format                      |
| `schema`        | object                       | --       | JSON schema the output should conform to   |
| `columns`       | string[]                     | --       | Column names for CSV/table output          |
| `urls`          | string[]                     | --       | URLs to scope the agent to                 |
| `model`         | `{provider, model}`          | config   | Override the primary model                 |
| `subAgentModel` | `{provider, model}`          | config   | Override the sub-agent model               |
| `maxSteps`      | number                       | `15`     | Max agent steps (1-50)                     |
| `skills`        | string[]                     | --       | Skills to enable for the run               |
