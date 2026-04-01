"use client";

import { useState } from "react";
import Link from "next/link";
import SymbolColored from "@/components/shared/icons/symbol-colored";
import { cn } from "@/utils/cn";

type Lang = "curl" | "javascript" | "python";

const LANG_LABELS: Record<Lang, string> = { curl: "cURL", javascript: "JavaScript", python: "Python" };

function CodeTabs({ examples }: { examples: Record<Lang, string> }) {
  const [lang, setLang] = useState<Lang>("curl");
  return (
    <div className="rounded-10 border border-border-faint overflow-hidden">
      <div className="flex border-b border-border-faint bg-black-alpha-2">
        {(Object.keys(examples) as Lang[]).map((l) => (
          <button
            key={l}
            type="button"
            className={cn(
              "px-14 py-6 text-mono-x-small transition-all border-b-2 -mb-px",
              lang === l ? "text-heat-100 border-heat-100 bg-accent-white" : "text-black-alpha-40 border-transparent hover:text-accent-black",
            )}
            onClick={() => setLang(l)}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto px-10 py-4 text-black-alpha-24 hover:text-accent-black transition-colors"
          title="Copy"
          onClick={() => navigator.clipboard.writeText(examples[lang])}
        >
          <svg fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </button>
      </div>
      <pre className="p-14 text-mono-small text-accent-black overflow-x-auto whitespace-pre leading-relaxed bg-accent-white">{examples[lang]}</pre>
    </div>
  );
}

function Param({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-10 py-8 border-b border-border-faint last:border-0">
      <div className="w-140 flex-shrink-0">
        <code className="text-mono-small text-accent-black">{name}</code>
        {required && <span className="text-mono-x-small text-accent-crimson ml-4">required</span>}
        <div className="text-mono-x-small text-black-alpha-24">{type}</div>
      </div>
      <div className="text-body-small text-black-alpha-56">{children}</div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-48 scroll-mt-80">
      <h2 className="text-title-h4 text-accent-black mb-16">{title}</h2>
      {children}
    </section>
  );
}

const NAV = [
  { id: "extract", label: "Extract" },
  { id: "query", label: "Query" },
  { id: "streaming", label: "Streaming" },
  { id: "skills", label: "Skills" },
  { id: "plan", label: "Plan" },
  { id: "conversations", label: "Conversations" },
  { id: "env", label: "Environment" },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background-base">
      <header className="border-b border-border-faint px-20 py-10 flex items-center gap-10 sticky top-0 bg-background-base/95 backdrop-blur z-10">
        <Link href="/" className="flex items-center gap-10 hover:opacity-80 transition-opacity">
          <SymbolColored width={22} height={32} />
        </Link>
        <nav className="ml-12 flex items-center gap-2">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="px-8 py-4 rounded-6 text-label-small text-black-alpha-48 hover:text-accent-black hover:bg-black-alpha-4 transition-all">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto">
          <span className="text-label-small text-heat-100 bg-heat-8 px-8 py-4 rounded-6">API</span>
        </div>
      </header>

      <div className="max-w-780 mx-auto px-20 py-32">
        <h1 className="text-title-h2 text-accent-black mb-6">API Reference</h1>
        <p className="text-body-large text-black-alpha-48 mb-40">
          REST API for web research, data extraction, and export. All endpoints accept JSON and return JSON.
        </p>

        {/* ── Extract ── */}
        <Section id="extract" title="POST /api/extract">
          <p className="text-body-medium text-black-alpha-48 mb-16">
            Run the agent with a prompt and get structured output in your chosen format.
          </p>

          <div className="mb-16">
            <h3 className="text-label-medium text-accent-black mb-8">Parameters</h3>
            <div className="border border-border-faint rounded-10 px-14">
              <Param name="prompt" type="string" required>The research task to execute.</Param>
              <Param name="format" type="string" required>&quot;json&quot; | &quot;csv&quot; | &quot;markdown&quot; | &quot;html&quot;</Param>
              <Param name="schema" type="object">JSON schema to enforce output structure (for json format).</Param>
              <Param name="columns" type="string[]">Column headers (for csv format).</Param>
              <Param name="urls" type="string[]">Seed URLs to start with.</Param>
              <Param name="skills" type="string[]">Skill names to preload (e.g. &quot;seo-audit&quot;, &quot;price-tracker&quot;).</Param>
              <Param name="model" type="string">Model ID. Default: claude-sonnet-4-6.</Param>
              <Param name="provider" type="string">&quot;anthropic&quot; | &quot;openai&quot; | &quot;google&quot;</Param>
              <Param name="maxSteps" type="number">Max agent steps. Default: 20.</Param>
            </div>
          </div>

          <CodeTabs examples={{
            curl: `curl -X POST http://localhost:3000/api/extract \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Compare pricing for Vercel and Netlify",
    "format": "json",
    "skills": ["price-tracker"],
    "schema": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "provider": { "type": "string" },
          "plan": { "type": "string" },
          "price": { "type": "string" }
        }
      }
    }
  }'`,
            javascript: `const res = await fetch("/api/extract", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "Compare pricing for Vercel and Netlify",
    format: "json",
    skills: ["price-tracker"],
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          provider: { type: "string" },
          plan: { type: "string" },
          price: { type: "string" },
        },
      },
    },
  }),
});
const data = await res.json();
console.log(data.data); // Extracted JSON`,
            python: `import requests

res = requests.post("http://localhost:3000/api/extract", json={
    "prompt": "Compare pricing for Vercel and Netlify",
    "format": "json",
    "skills": ["price-tracker"],
    "schema": {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "provider": {"type": "string"},
                "plan": {"type": "string"},
                "price": {"type": "string"},
            },
        },
    },
})
data = res.json()
print(data["data"])`,
          }} />

          <div className="mt-16 rounded-10 border border-border-faint overflow-hidden">
            <div className="px-14 py-8 bg-black-alpha-2 border-b border-border-faint text-label-x-small text-black-alpha-32">Response</div>
            <pre className="p-14 text-mono-small text-accent-black overflow-x-auto whitespace-pre leading-relaxed">{`{
  "format": "json",
  "data": "[{ \"provider\": \"Vercel\", \"plan\": \"Pro\", \"price\": \"$20/mo\" }, ...]",
  "text": "I scraped both pricing pages and compared...",
  "usage": { "promptTokens": 12500, "completionTokens": 3200 }
}`}</pre>
          </div>
        </Section>

        {/* ── Query ── */}
        <Section id="query" title="POST /api/query">
          <p className="text-body-medium text-black-alpha-48 mb-16">
            Free-form query with full step-by-step response. Supports both synchronous and streaming modes.
          </p>

          <div className="mb-16">
            <h3 className="text-label-medium text-accent-black mb-8">Parameters</h3>
            <div className="border border-border-faint rounded-10 px-14">
              <Param name="prompt" type="string" required>The query to run.</Param>
              <Param name="stream" type="boolean">Enable SSE streaming. Default: false.</Param>
              <Param name="skills" type="string[]">Skill names to preload.</Param>
              <Param name="model" type="string">Model ID.</Param>
              <Param name="provider" type="string">&quot;anthropic&quot; | &quot;openai&quot; | &quot;google&quot;</Param>
              <Param name="urls" type="string[]">Seed URLs.</Param>
              <Param name="maxSteps" type="number">Max agent steps.</Param>
            </div>
          </div>

          <CodeTabs examples={{
            curl: `curl -X POST http://localhost:3000/api/query \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "What are the top stories on Hacker News?",
    "skills": ["web-research"],
    "stream": false
  }'`,
            javascript: `const res = await fetch("/api/query", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "What are the top stories on Hacker News?",
    skills: ["web-research"],
    stream: false,
  }),
});
const data = await res.json();
console.log(data.text);
console.log(data.steps); // Array of agent steps`,
            python: `import requests

res = requests.post("http://localhost:3000/api/query", json={
    "prompt": "What are the top stories on Hacker News?",
    "skills": ["web-research"],
    "stream": False,
})
data = res.json()
print(data["text"])
for step in data["steps"]:
    print(step["toolCalls"])`,
          }} />
        </Section>

        {/* ── Streaming ── */}
        <Section id="streaming" title="Streaming (SSE)">
          <p className="text-body-medium text-black-alpha-48 mb-16">
            Set <code className="text-mono-small bg-black-alpha-4 px-4 py-1 rounded">stream: true</code> on /api/query to receive Server-Sent Events. Each event is a JSON object with a <code className="text-mono-small bg-black-alpha-4 px-4 py-1 rounded">type</code> field.
          </p>

          <div className="mb-16 border border-border-faint rounded-10 px-14">
            <Param name="text" type="event">Agent thinking/narration text chunk.</Param>
            <Param name="tool-call" type="event">Tool invocation with name and input.</Param>
            <Param name="tool-result" type="event">Tool output with name and result.</Param>
            <Param name="done" type="event">Final event with full text and usage stats.</Param>
          </div>

          <CodeTabs examples={{
            curl: `curl -N -X POST http://localhost:3000/api/query \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Find AI news", "stream": true}'

# Output:
# data: {"type":"text","content":"Searching for..."}
# data: {"type":"tool-call","name":"search","input":{"query":"AI news 2025"}}
# data: {"type":"tool-result","name":"search","output":{"web":[...]}}
# data: {"type":"text","content":"Found 5 articles..."}
# data: {"type":"done","text":"...","usage":{"promptTokens":8000}}`,
            javascript: `const res = await fetch("/api/query", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "Find AI news", stream: true }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const lines = decoder.decode(value).split("\\n");
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const event = JSON.parse(line.slice(6));
    switch (event.type) {
      case "text":
        process.stdout.write(event.content);
        break;
      case "tool-call":
        console.log("Tool:", event.name, event.input);
        break;
      case "done":
        console.log("\\nDone. Tokens:", event.usage);
        break;
    }
  }
}`,
            python: `import requests
import json

res = requests.post(
    "http://localhost:3000/api/query",
    json={"prompt": "Find AI news", "stream": True},
    stream=True,
)

for line in res.iter_lines():
    line = line.decode()
    if not line.startswith("data: "):
        continue
    event = json.loads(line[6:])
    if event["type"] == "text":
        print(event["content"], end="", flush=True)
    elif event["type"] == "tool-call":
        print(f"\\nTool: {event['name']}")
    elif event["type"] == "done":
        print(f"\\nDone. Tokens: {event['usage']}")`,
          }} />
        </Section>

        {/* ── Skills ── */}
        <Section id="skills" title="Skills">
          <p className="text-body-medium text-black-alpha-48 mb-16">
            Skills are reusable instruction sets in <code className="text-mono-small bg-black-alpha-4 px-4 py-1 rounded">agent-core/src/skills/definitions/</code>. Pass skill names to any endpoint to preload domain knowledge.
          </p>

          <div className="mb-16 grid grid-cols-2 gap-8">
            {[
              { cat: "Research", skills: "web-research, deep-research, knowledge-base, data-extraction" },
              { cat: "SEO", skills: "seo-audit, seo-keyword-research" },
              { cat: "Sales", skills: "lead-enrichment, competitive-analysis" },
              { cat: "Finance", skills: "company-research, financial-data" },
              { cat: "E-commerce", skills: "price-tracker, product-monitor" },
              { cat: "Content", skills: "content-generation, news-monitoring" },
              { cat: "Ops", skills: "site-monitor, data-migration" },
              { cat: "Export", skills: "export-json, export-csv, export-report, export-html, export-slides, export-spreadsheet, export-pdf, export-document" },
            ].map(({ cat, skills }) => (
              <div key={cat} className="border border-border-faint rounded-10 p-12">
                <div className="text-label-small text-accent-black mb-4">{cat}</div>
                <div className="text-mono-x-small text-black-alpha-40 leading-relaxed">{skills}</div>
              </div>
            ))}
          </div>

          <CodeTabs examples={{
            curl: `# List available skills
curl http://localhost:3000/api/skills

# Use skills in a query
curl -X POST http://localhost:3000/api/query \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Audit the SEO of https://example.com",
    "skills": ["seo-audit"]
  }'`,
            javascript: `// List skills
const skills = await fetch("/api/skills").then(r => r.json());
console.log(skills.map(s => s.name));

// Use skills
const res = await fetch("/api/query", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "Audit the SEO of https://example.com",
    skills: ["seo-audit"],
  }),
});`,
            python: `import requests

# List skills
skills = requests.get("http://localhost:3000/api/skills").json()
print([s["name"] for s in skills])

# Use skills
res = requests.post("http://localhost:3000/api/query", json={
    "prompt": "Audit the SEO of https://example.com",
    "skills": ["seo-audit"],
})`,
          }} />

          <div className="mt-16">
            <h3 className="text-label-medium text-accent-black mb-8">Endpoints</h3>
            <div className="border border-border-faint rounded-10 px-14">
              <Param name="GET /api/skills" type="endpoint">List all skills with name, description, category.</Param>
              <Param name="GET /api/skills/:name" type="endpoint">Get a skill&apos;s full SKILL.md content.</Param>
              <Param name="POST /api/skills/generate" type="endpoint">Generate a new skill from a conversation transcript.</Param>
            </div>
          </div>
        </Section>

        {/* ── Plan ── */}
        <Section id="plan" title="POST /api/plan">
          <p className="text-body-medium text-black-alpha-48 mb-16">
            Generate an execution plan without running it. Returns a step-by-step strategy the agent would follow.
          </p>

          <CodeTabs examples={{
            curl: `curl -X POST http://localhost:3000/api/plan \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Compare the top 5 headless CMS platforms",
    "config": {
      "model": { "provider": "anthropic", "model": "claude-sonnet-4-6" }
    }
  }'`,
            javascript: `const res = await fetch("/api/plan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: "Compare the top 5 headless CMS platforms",
    config: {
      model: { provider: "anthropic", model: "claude-sonnet-4-6" },
    },
  }),
});
const { plan } = await res.json();
console.log(plan); // Numbered step-by-step plan`,
            python: `import requests

res = requests.post("http://localhost:3000/api/plan", json={
    "prompt": "Compare the top 5 headless CMS platforms",
    "config": {
        "model": {"provider": "anthropic", "model": "claude-sonnet-4-6"},
    },
})
print(res.json()["plan"])`,
          }} />
        </Section>

        {/* ── Conversations ── */}
        <Section id="conversations" title="Conversations">
          <p className="text-body-medium text-black-alpha-48 mb-16">
            Persist and retrieve conversation history.
          </p>

          <div className="border border-border-faint rounded-10 px-14 mb-16">
            <Param name="GET /api/conversations" type="endpoint">List all conversations, most recent first.</Param>
            <Param name="GET /api/conversations/:id" type="endpoint">Get conversation with full message history.</Param>
            <Param name="POST /api/conversations" type="endpoint">Save a new conversation.</Param>
            <Param name="DELETE /api/conversations/:id" type="endpoint">Delete a conversation.</Param>
          </div>

          <CodeTabs examples={{
            curl: `# List conversations
curl http://localhost:3000/api/conversations

# Get a specific conversation
curl http://localhost:3000/api/conversations/conv-abc123`,
            javascript: `// List conversations
const convos = await fetch("/api/conversations").then(r => r.json());

// Get specific conversation
const convo = await fetch(\`/api/conversations/\${id}\`).then(r => r.json());
console.log(convo.messages);`,
            python: `import requests

# List
convos = requests.get("http://localhost:3000/api/conversations").json()

# Get specific
convo = requests.get(f"http://localhost:3000/api/conversations/{id}").json()
print(convo["messages"])`,
          }} />
        </Section>

        {/* ── Environment ── */}
        <Section id="env" title="Environment">
          <p className="text-body-medium text-black-alpha-48 mb-16">
            Required and optional environment variables. Set in <code className="text-mono-small bg-black-alpha-4 px-4 py-1 rounded">.env.local</code>.
          </p>

          <div className="border border-border-faint rounded-10 px-14">
            <Param name="FIRECRAWL_API_KEY" type="string" required>Powers search, scrape, and interact tools.</Param>
            <Param name="ANTHROPIC_API_KEY" type="string">For Claude models (default provider).</Param>
            <Param name="OPENAI_API_KEY" type="string">For OpenAI models.</Param>
            <Param name="GOOGLE_GENERATIVE_AI_API_KEY" type="string">For Google models.</Param>
          </div>
        </Section>

        <div className="text-body-small text-black-alpha-24 text-center py-12 border-t border-border-faint">
          Built with Firecrawl + AI SDK
        </div>
      </div>
    </div>
  );
}
