# Examples

Working examples showing how to call the Firecrawl Agent from different languages and frameworks.

## Quick Start

All examples assume a running Firecrawl Agent server at `http://localhost:3000/api/v1`. Start one with:

```bash
npm run dev
```

## Examples

| Example | Language | Framework | Use Case |
|---------|----------|-----------|----------|
| [curl](./curl/) | Shell | None | Universal baseline. Copy-paste HTTP calls. |
| [python-basic](./python-basic/) | Python | requests | Simple script. No AI framework. |
| [python-langchain](./python-langchain/) | Python | LangChain | Use the agent as a tool in a LangChain chain. |
| [typescript-ai-sdk](./typescript-ai-sdk/) | TypeScript | AI SDK | Direct import of agent-core. No HTTP server needed. |
| [go-basic](./go-basic/) | Go | stdlib | HTTP client using only the standard library. |

## Two ways to use the agent

**HTTP client (any language)** -- call the deployed agent as an API. This is what curl, Python, and Go examples show.

**Direct import (TypeScript only)** -- import `agent-core` as a library. No HTTP overhead. This is what the typescript-ai-sdk example shows.

## Adding new examples

Create a directory with:
- `README.md` -- setup and run instructions
- Source file(s) -- keep it minimal, under 50 lines
