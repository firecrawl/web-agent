1. Copy `railway.toml` to the project root.
2. Run `npm i -g @railway/cli && railway login`.
3. Run `railway init` to create a new project, then `railway link`.
4. Set `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`, and any other env vars via `railway variables set`.
5. Run `railway up` to deploy. Railway auto-detects Node.js and exposes port 3000.
