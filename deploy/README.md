# Deployment

Choose a platform based on your needs:

| Platform   | Template          | Cold Start | Cost Tier        |
|------------|-------------------|------------|------------------|
| Vercel     | `vercel/`         | ~250ms     | Free / Pro ($20) |
| Railway    | `railway/`        | ~1s        | Usage-based      |
| Docker     | `docker/`         | None       | Self-hosted      |
| Cloudflare | `cloudflare/`     | N/A        | Not recommended  |

Each directory contains a config template and a short README with setup steps.

## Environment Variables

All platforms require these env vars at minimum:

- `ANTHROPIC_API_KEY` -- Claude API key for the agent
- `FIRECRAWL_API_KEY` -- Firecrawl API key for web scraping

## Notes

- **Vercel** is the simplest path for Next.js. API routes need Pro plan for >60s timeouts.
- **Railway** auto-detects Node.js and handles SSL/domains. Good for long-running agent tasks.
- **Docker** gives full control. Requires `output: "standalone"` in `next.config.ts`.
- **Cloudflare** has Node.js API limitations that conflict with agent-core. See its README.
