Cloudflare Workers / Pages is not recommended for this project.

The agent-core module depends on Node.js APIs (`fs`, `child_process`, `better-sqlite3`)
that are unavailable in the Cloudflare Workers runtime. Deploying as-is will fail at
runtime when the agent tries to use these APIs.

If you need Cloudflare deployment:
1. Use the `@cloudflare/next-on-pages` adapter with Node.js compatibility flags enabled.
2. Replace `better-sqlite3` with Cloudflare D1 and remove `just-bash` / `child_process` usage.
3. Alternatively, consider the Hono framework (`hono/cloudflare-workers`) with a stripped-down
   API layer that proxies to an external agent service running on a Node.js-compatible host.

For most use cases, Vercel, Railway, or Docker will be a better fit.
