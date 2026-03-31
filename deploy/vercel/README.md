1. Copy `vercel.json` to the project root.
2. Run `npm i -g vercel && vercel login`.
3. Set `ANTHROPIC_API_KEY`, `FIRECRAWL_API_KEY`, and any other env vars in Vercel dashboard.
4. Run `vercel --prod` from the project root.
5. API routes have a 300s max duration -- requires a Vercel Pro plan for timeouts above 60s.
