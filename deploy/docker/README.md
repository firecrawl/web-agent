1. Add `output: "standalone"` to `next.config.ts` before building.
2. Copy `Dockerfile` and `.dockerignore` to the project root.
3. Run `docker build -t firecrawl-agent .` from the project root.
4. Run `docker run -p 3000:3000 -e ANTHROPIC_API_KEY=... -e FIRECRAWL_API_KEY=... firecrawl-agent`.
5. The app is available at `http://localhost:3000`.
