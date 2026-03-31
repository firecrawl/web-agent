# Python Basic Example

Run a single prompt against the Firecrawl Agent API and print the response.

## Setup

```
pip install requests
```

## Run

Start the agent server first (`npm run dev` in the project root), then:

```
python main.py
```

To point at a different server, set the `FIRECRAWL_AGENT_URL` environment variable:

```
FIRECRAWL_AGENT_URL=https://my-deployment.vercel.app/api/v1 python main.py
```
