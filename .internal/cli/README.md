# Firecrawl Agent CLI

Scaffold, run, and deploy Firecrawl Agent projects.

## Install

> Coming soon to the [Firecrawl CLI](https://www.npmjs.com/package/firecrawl-cli) as `firecrawl agent init`. For now, build locally:

```bash
cd cli && npm install && npm run build && npm link
```

This gives you the `firecrawl-agent` command globally.

---

## Commands

### `firecrawl-agent init`

Create a new project. Picks a template, detects your API keys, scaffolds everything.

```bash
firecrawl-agent init my-agent
```

```
  firecrawl-agent
  AI-powered web research agent

? Template
❯ Next.js (Full UI)      Complete web app with chat UI, history, settings
  Express (API only)     Lightweight Node.js API server with /v1/run endpoint
  Hono (Serverless)      Fast, lightweight API - ideal for edge and serverless

✓ Next.js (Full UI) template scaffolded
✓ Created .env.local
✓ Dependencies installed

Ready!  /Users/you/my-agent

  cd my-agent && npm run dev
```

**Skip prompts with flags:**

```bash
firecrawl-agent init my-agent -t next                            # pick template
firecrawl-agent init my-agent -t express --api-key fc-...        # set Firecrawl key
firecrawl-agent init my-agent -t hono --key anthropic=sk-...     # set provider keys
firecrawl-agent init my-agent -t express --key openai=sk-... --key google=AIza...
firecrawl-agent init my-agent --from user/repo                   # from external repo
firecrawl-agent init my-agent --from ./local-path                # from local directory
firecrawl-agent init my-agent -t express --skip-install          # don't run npm install
```

**All flags:**

| Flag | Description |
|------|-------------|
| `-t, --template <id>` | `next`, `express`, or `hono` |
| `--api-key <key>` | Firecrawl API key |
| `--key <provider=key>` | Provider key (repeatable) - `anthropic`, `openai`, `google`, `gateway` |
| `--from <source>` | External GitHub repo (`user/repo`) or local path |
| `--skip-install` | Skip `npm install` |

**API key detection:** The CLI checks these sources in order:
1. `--api-key` flag
2. `FIRECRAWL_API_KEY` environment variable
3. Firecrawl CLI stored credentials (`~/Library/Application Support/firecrawl-cli/`)
4. Interactive prompt

---

### `firecrawl-agent dev`

Start the development server in a scaffolded project.

```bash
firecrawl-agent dev my-agent
```

```
  Starting dev server in my-agent...

  ▲ Next.js 16.2.2 (Turbopack)
  - Local: http://localhost:3000
  ✓ Ready in 237ms
```

Reads the `dev` script from the project's `package.json` and runs it.

```bash
firecrawl-agent dev                  # current directory
firecrawl-agent dev my-agent         # specific directory
```

---

### `firecrawl-agent deploy`

Generate deploy configs and print the deploy command. Auto-detects the framework.

```bash
firecrawl-agent deploy my-agent
```

```
? Where would you like to deploy?
❯ Vercel
  Railway
  Docker

✓ Created vercel.json

  Deploy with:
  $ cd my-agent
  $ npx vercel
```

**Skip prompts:**

```bash
firecrawl-agent deploy my-agent -p vercel     # generates vercel.json
firecrawl-agent deploy my-agent -p railway    # generates railway.toml
firecrawl-agent deploy my-agent -p docker     # generates Dockerfile + .dockerignore
```

**What gets generated:**

| Platform | Files | Notes |
|----------|-------|-------|
| Vercel | `vercel.json` | 300s function timeout for Next.js |
| Railway | `railway.toml` | Nixpacks build, health check, auto-restart |
| Docker | `Dockerfile`, `.dockerignore` | Multi-stage build for Next.js, simple build for Express/Hono |

---

## Templates

| ID | Name | What you get |
|----|------|-------------|
| `next` | Next.js (Full UI) | Chat UI, conversation history, settings, streaming visualization |
| `express` | Express (API only) | Single `POST /v1/run` endpoint, ~60 lines |
| `hono` | Hono (Serverless) | Single `POST /v1/run` endpoint, SSE streaming, ~65 lines |

---

## External templates

Any repo or directory with an `agent-manifest.json` at root works as a template source:

```bash
firecrawl-agent init my-agent --from user/repo
firecrawl-agent init my-agent --from ./my-templates
```

The manifest defines available templates, required env vars, and provider options. See [`agent-manifest.json`](./agent-manifest.json) for the schema.
