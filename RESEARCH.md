# Dead-simple DX: Mastra vs Deep Agents TS vs today

**Goal:** shrink the custom AI SDK v5 `ToolLoopAgent` abstraction around orchestration / sub-agents / skills. DX above all.

## Current baseline (LOC, excluding tests)

| Concern | File(s) | LOC |
|---|---|---|
| Agent facade (run/stream/sse/toResponse/plan) | `agent.ts` | 429 |
| Orchestrator (model + tools + prompt + compaction + repair) | `orchestrator/index.ts` + `compaction.ts` + `loader.ts` | 496 |
| Sub-agents → tools | `orchestrator/sub-agents.ts` | 210 |
| Worker fan-out (`spawnAgents`) | `worker/index.ts` + `loader.ts` | 272 |
| Skills (discovery + parser + `load_skill` + `exportSkill`) | `skills/*.ts` | 343 |
| Tools (bashExec, formatOutput, exportSkill…) | `tools.ts` | 288 |
| Toolkit + types + resolve-model | `toolkit.ts` + `types.ts` + `resolve-model.ts` | 258 |
| **Total in scope** |  | **~2,300** |

Hello-world from a user's perspective is already short (`createAgent(...).run({prompt})`), but the package is heavy. The question is whether the ceiling can come down without hurting the floor.

---

## Deep Agents TS (`deepagents@1.9.0`)

### The DX

```ts
import { createDeepAgent } from "deepagents";
import { ChatAnthropic } from "@langchain/anthropic";

const agent = createDeepAgent({
  model: new ChatAnthropic({ model: "claude-sonnet-4-5" }),
  tools: [firecrawlSearch, firecrawlScrape, firecrawlInteract],
  subagents: [{ name: "scraper", description: "...", systemPrompt: "..." }],
  skills: ["./skills/"],     // <-- SKILL.md discovery built in
});

const result = await agent.invoke({ messages: [{ role: "user", content: "get Vercel pricing" }] });
```

**~15 LOC** including imports. The four custom subsystems (sub-agents, workers/task, skills, VFS) collapse into four constructor fields.

### What it subsumes (dead)

- `orchestrator/sub-agents.ts` (210) → `subagents: [...]` field
- `skills/discovery.ts` + `skills/parser.ts` + `skills/tools.ts` (~270) → `skills: ["./path"]`
- Most of `worker/` (272) → built-in `task` tool with context quarantine
- `tools.ts` bash/file bits → built-in `read_file`/`write_file`/`edit_file`/`glob`/`grep`/`ls`
- `write_todos` planning tool built in → deprecates handwritten plan shaping

### What it replaces (and costs you)

- **Model layer rip-and-replace.** `@ai-sdk/anthropic` → `@langchain/anthropic`. Your `resolveModel()` logic targeting AI SDK providers moves over, not a compat shim in sight.
- **LangGraph runtime lock-in.** Streaming, checkpointing, middleware all flow through LangGraph idioms.
- **Parallel fan-out is LLM-batched.** Your explicit `spawnAgents` that fires N workers concurrently becomes "hope the model emits parallel `task` tool calls." Reliability might drop.

### Sandbox answer

**No sandbox required.** Default `StateBackend` is in-memory, in-process. Daytona/E2B/Modal backends are opt-in for real code exec.

---

## Mastra (`@mastra/core`)

### The DX

```ts
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

const scraper = new Agent({ name: "scraper", instructions: "...", model: openai("gpt-4") });
const main = new Agent({
  name: "main",
  instructions: ({ runtimeContext }) => loadSkillsIntoPrompt(...),  // file-based skills go here
  model: openai("gpt-4"),
  tools: { firecrawlSearch, firecrawlScrape },  // AI SDK tool() objects pass through
  agents: { scraper },                           // auto-exposed as tool "agent-scraper"
});

const res = await main.generate([{ role: "user", content: "get Vercel pricing" }]);
```

**~10 LOC**, and critically **keeps `@ai-sdk/*` model providers unchanged.**

### What it subsumes

- `orchestrator/sub-agents.ts` (210) → `agents: { ... }` auto-wired
- Most of `agent.ts` streaming facade → `@mastra/ai-sdk` helpers (`toAISdkStream`)
- Orchestrator tool-loop wiring → native in `Agent`
- Observability → OTel built-in

### What it doesn't subsume

- **No built-in skills loader.** You keep your SKILL.md discovery and inject via function-form `instructions: ({ runtimeContext }) => string`. Your ~340 LOC of skills code shrinks maybe 20% (the `load_skill` tool becomes unnecessary if instructions are computed per-run).
- **`bashExec` / `exportSkill`** stay as `createTool` definitions. Same LOC.
- **Memory / compaction** — `Memory` is powerful but requires storage (LibSQL/Postgres). For in-process compaction, keep your `prepareStep` module or adopt storage. Your call.
- **Parallel fan-out** — workflows' `.parallel([...])` handles known cases; dynamic fan-out still wants a ~30 LOC `spawnAgents` tool.
- **Workflows have ceremony.** Every step needs `inputSchema`/`outputSchema`, `.commit()` required. Overkill for LLM-driven flows — stick with `Agent`.

### Sandbox answer

**No sandbox.** Same in-process execution as AI SDK.

---

## Head-to-head for *this* codebase

| Concern | Today (LOC) | Mastra | Deep Agents TS |
|---|---|---|---|
| Sub-agents | 210 | ~0 (native) | ~0 (native) |
| Skills loader | 343 | ~280 (kept, plug into `instructions()`) | ~0 (native `skills: [path]`) |
| Worker fan-out | 272 | ~30 (thin tool) | LLM-batched, possibly ~0 |
| Streaming facade | 200-ish of `agent.ts` | ~20 via `@mastra/ai-sdk` | native LangGraph stream |
| Compaction | 185 | keep or adopt `Memory` | keep (no native) |
| Orchestrator wiring | 234 | ~50 (agent construction) | ~10 |
| Model resolver | 51 | keep (AI SDK same) | rewrite for `@langchain/*` |
| Tools (bash/format/export) | 288 | keep | mostly replaced by VFS built-ins (~100 left) |
| **Est. total** | **~2,300** | **~700–900** | **~300–500** |

## The honest call

**Deep Agents TS wins on raw DX** — `skills: ["./path"]` is literally the one-line thing that kills your biggest custom subsystem, and the VFS + `task` tool + `write_todos` collectively replace four hand-rolled layers. If dead-simple is the only criterion, it's the answer.

**But there are two real costs:**

1. **AI SDK provider ecosystem goes away.** Anything downstream using `@ai-sdk/gateway`, `useChat`, AI SDK tool-calling semantics, or streaming to a Next.js UI via AI SDK's conventions breaks. You swap `@ai-sdk/*` for `@langchain/*` top-to-bottom.
2. **LangGraph is a runtime, not a library.** You're buying into their streaming shape, checkpointing, middleware model. Debugging goes through LangGraph's lens.

**Mastra is the middle path:** half the LOC reduction, but zero provider churn. You keep AI SDK models, keep AI SDK tool definitions, and pick up native sub-agents + streaming + OTel. The skills layer stays yours, just cleaner.

### Recommendation (opinion, not decided)

- If you're willing to cut the AI SDK cord and want the absolute shortest `createAgent` signature: **Deep Agents TS**. Build a thin `createFirecrawlAgent()` wrapper that injects Firecrawl tools + skills path and you're done. ~300 LOC total package.
- If you want to keep `@ai-sdk/*` provider ecosystem and ship Next.js SSE cleanly: **Mastra**. Still a big win, just not as dramatic.
- Prototype both as ~100-LOC spikes in separate branches before committing. The LOC estimates above are directional — the real surprises are in streaming/SSE adapters and error paths.

### Sandbox, answered directly

Neither Mastra nor Deep Agents TS requires a sandbox. Both run in-process with just Node + API keys, same as your current AI SDK setup. Sandboxes (Daytona/E2B/Modal) are opt-in only if you want real code execution beyond a virtual filesystem.
