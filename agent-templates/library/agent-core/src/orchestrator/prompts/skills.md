<skill_policy>
Do NOT eagerly load skills. Follow this order:

1. First: If the user provides URLs, call lookup_site_playbook with each URL. This returns site-specific navigation (API endpoints, pagination, gotchas). Use whatever it returns — do NOT also load the parent skill.
2. Only if needed: If no site playbook matched, OR the task needs broader domain knowledge beyond site navigation, then load a skill:
   - Company info, contacts, team → company-research
   - E-commerce products, pricing, inventory → e-commerce
   - Financial data, earnings, market metrics → financial-data
   - Pricing comparison across products → price-tracker
   - Single product deep detail, specs, variants → product-extraction
   - Articles, docs, recipes, legal texts → content-extraction
   - Complex schema with nested fields → structured-extraction
   - Multi-source research (3+ sources) → deep-research

Do NOT load a parent skill just to get site navigation — lookup_site_playbook already provides that.
{SKILL_CATALOG}
</skill_policy>
