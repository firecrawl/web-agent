import { generateText, type ModelMessage, type LanguageModel } from "ai";

const MODEL_TOKEN_LIMITS: Record<string, number> = {
  "claude-sonnet-4-6": 200_000,
  "claude-sonnet-4-5": 200_000,
  "claude-haiku-4-5": 200_000,
  "claude-haiku-4-5-20251001": 200_000,
  "claude-opus-4-6": 200_000,
  "gemini-3.1-pro-preview": 1_000_000,
  "gemini-3-flash-preview": 1_000_000,
  "gemini-3.1-flash-lite-preview": 1_000_000,
  "gemini-2.5-flash": 1_000_000,
  "gemini-2.5-pro-preview-05-06": 1_000_000,
  "gpt-5.4": 128_000,
  "gpt-4.1": 128_000,
  "o4-mini": 128_000,
};

const COMPACTION_THRESHOLD = 0.75;

const NO_TOOLS_PREAMBLE = `CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.
You already have all the context you need in the conversation above.
Your entire response must be plain text: an <analysis> block followed by a <summary> block.

`;

const NO_TOOLS_TRAILER = `

REMINDER: Do NOT call any tools. Respond with plain text only -- an <analysis> block followed by a <summary> block.`;

const COMPACTION_PROMPT = `${NO_TOOLS_PREAMBLE}You are a conversation compactor for a web research and data extraction agent. Create a detailed summary that allows the agent to continue its work without re-doing any steps.

Before writing your summary, wrap your analysis in <analysis> tags to organize your thoughts. In your analysis:
1. Walk through the conversation chronologically, identifying every URL scraped, every data point found, every error hit.
2. Check which schema fields (if any) have been populated vs are still missing.
3. Note the exact state of progress -- what was the agent doing right before this compaction?

Your summary (inside <summary> tags) MUST include these sections:

1. Original Task
   The user's request, verbatim or near-verbatim. Include the schema/fields requested if applicable.

2. URLs Scraped and Findings
   For each URL accessed, list: the URL, what was found, and whether it succeeded or failed.
   - [URL] → [key data extracted or error]

3. Data Collected
   Structured data gathered so far. Include actual values, not just "we found pricing info."

4. Schema Progress (if a schema was provided)
   - Fields populated: [list with values]
   - Fields still missing: [list]

5. Workers/Agents Spawned
   For each: what it was asked to do, what it returned.

6. Errors and Resolutions
   What failed and how it was handled. Include specific error messages.

7. Current Work
   Precisely what was happening right before compaction. Include the last URL being processed, the last tool call made, and where in the workflow the agent was.

8. Next Step
   The single next action the agent should take to continue. Be specific: "scrape page 3 of https://example.com/products?page=3" not "continue scraping."${NO_TOOLS_TRAILER}`;

function messagesToText(messages: ModelMessage[]): string {
  return messages
    .map((msg, idx) => {
      const content = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? (msg.content as Record<string, unknown>[])
              .map((block) => {
                if (block.type === "text") return block.text;
                if (block.type === "tool-call")
                  return `[Tool: ${block.toolName}(${JSON.stringify(block.input).slice(0, 500)})]`;
                if (block.type === "tool-result")
                  return `[Result: ${JSON.stringify(block.output).slice(0, 1000)}]`;
                return JSON.stringify(block).slice(0, 500);
              })
              .join("\n")
          : JSON.stringify(msg.content).slice(0, 2000);
      return `[${msg.role.toUpperCase()} ${idx}]: ${content}`;
    })
    .join("\n\n");
}

export interface CompactionState {
  hasCompacted: boolean;
  lastInputTokens: number;
}

export function createCompactionState(): CompactionState {
  return { hasCompacted: false, lastInputTokens: 0 };
}

function getTokenLimit(modelName: string): number {
  return MODEL_TOKEN_LIMITS[modelName] ?? 200_000;
}

function needsCompaction(state: CompactionState, modelName: string): boolean {
  if (state.hasCompacted) return false;
  const limit = getTokenLimit(modelName);
  return state.lastInputTokens >= limit * COMPACTION_THRESHOLD;
}

/**
 * Strip the <analysis> scratchpad (used to improve summary quality but has no
 * informational value once written) and extract the <summary> content.
 */
function formatCompactSummary(raw: string): string {
  let result = raw;

  // Strip analysis section
  result = result.replace(/<analysis>[\s\S]*?<\/analysis>/, "");

  // Extract summary content
  const match = result.match(/<summary>([\s\S]*?)<\/summary>/);
  if (match) {
    result = match[1]?.trim() ?? result;
  }

  // Clean up extra whitespace
  result = result.replace(/\n\n\n+/g, "\n\n");

  return `CONTEXT FROM PREVIOUS CONVERSATION:\n\n${result.trim()}`;
}

export async function compactMessages(
  messages: ModelMessage[],
  compactionModel: LanguageModel,
): Promise<ModelMessage[]> {
  if (messages.length <= 2) return messages;

  const systemPrompt = messages[0];
  const conversationMessages = messages.slice(1);
  const conversationText = messagesToText(conversationMessages);

  const response = await generateText({
    model: compactionModel,
    messages: [
      { role: "user", content: `${COMPACTION_PROMPT}\n\nCONVERSATION TO SUMMARIZE:\n${conversationText}` },
    ],
    maxOutputTokens: 16000,
  });

  const formattedSummary = formatCompactSummary(response.text);

  return [
    systemPrompt,
    { role: "user" as const, content: formattedSummary },
  ];
}

/**
 * Create a prepareStep hook that compacts context when approaching the model's token limit.
 * Uses the provided LanguageModel directly -- caller decides which model to use.
 */
export function createPrepareStepWithCompaction(
  orchestratorModelName: string,
  compactionModel: LanguageModel,
) {
  const state = createCompactionState();

  return {
    state,
    prepareStep: async ({ steps, messages }: { steps: unknown[]; messages: ModelMessage[] }) => {
      const lastStep = steps[steps.length - 1] as { usage?: { inputTokens?: number } } | undefined;
      if (lastStep?.usage?.inputTokens) {
        state.lastInputTokens = lastStep.usage.inputTokens;
      }

      if (!needsCompaction(state, orchestratorModelName)) {
        return { messages };
      }

      try {
        const compacted = await compactMessages(messages, compactionModel);
        state.hasCompacted = true;
        state.lastInputTokens = 0;
        return { messages: compacted };
      } catch {
        return { messages };
      }
    },
  };
}
