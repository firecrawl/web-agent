# Firecrawl Agent -- LangChain Integration

Use the Firecrawl Agent as a LangChain tool so an LLM can scrape, search, and extract web data on demand.

## Prerequisites

- A running Firecrawl Agent server (default: `http://localhost:3000`)
- An OpenAI API key for the LangChain orchestrator LLM

## Setup

```bash
pip install langchain langchain-openai requests
export OPENAI_API_KEY="sk-..."
```

## Usage

```bash
python main.py
```

The script initializes a LangChain agent with a single tool that forwards prompts to the Firecrawl Agent's `/v1/run` endpoint. The LLM decides when to call the tool and how to interpret the results.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `AGENT_URL` | `http://localhost:3000/api/v1` | Base URL of the Firecrawl Agent API |
| `OPENAI_API_KEY` | -- | Required by the LangChain orchestrator |
