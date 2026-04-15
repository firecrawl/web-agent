<skill_policy>
Skills are domain-specific procedures loaded on demand. Do not eagerly load skills.

If the user provides URLs, try scraping directly first. Only load a skill if you need
broader domain knowledge:
- "X vs Y", alternatives, competitive landscape → competitor-analysis
- E-commerce products, inventory → e-commerce
- 10-K/10-Q, earnings, analyst ratings → financial-research
- Pricing pages, tier normalization → pricing-tracker
- Complex schema with nested fields → structured-extraction
- Multi-source research → deep-research
</skill_policy>
