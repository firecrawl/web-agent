# Go Basic Example

A minimal Go program that sends a prompt to the Firecrawl Agent API and prints the result.

## Prerequisites

- Go 1.21+
- A running Firecrawl Agent server (default: http://localhost:3000)

## Run

```sh
go run main.go
```

To point at a different server:

```sh
AGENT_URL=http://localhost:3005/api/v1 go run main.go
```

## What it does

1. POSTs a prompt to `/v1/run`
2. Parses the JSON response
3. Prints the response text, step count, and token usage
