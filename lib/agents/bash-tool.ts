import { tool } from "ai";
import { z } from "zod";

let sharedBash: { exec: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }> } | null =
  null;

export async function initBashWithFiles(
  files: Record<string, string>,
) {
  const { Bash } = await import("just-bash");
  sharedBash = new Bash();
  for (const [path, content] of Object.entries(files)) {
    await sharedBash.exec(`mkdir -p "$(dirname "${path}")"`);
    // Write file using heredoc to handle special characters
    await sharedBash.exec(
      `cat > "${path}" << 'FIRECRAWL_EOF'\n${content}\nFIRECRAWL_EOF`,
    );
  }
}

export const bashExec = tool({
  description:
    "Execute a bash command in a sandboxed environment with a persistent filesystem. Available tools: jq, awk, sed, grep, sort, uniq, wc, head, tail, cut, tr, paste, cat, echo, printf, bc. NOT available: node, python, curl, wget, npm, pip. The filesystem persists between calls — write files in one call, read them in the next. Use jq for JSON processing, awk for CSV/text processing. If a CSV was uploaded, it's at /data/input.csv.",
  inputSchema: z.object({
    command: z
      .string()
      .describe(
        "The bash command to execute. Examples: 'cat /data/input.csv | head -5', 'echo data | jq .', 'awk -F, \\'NR>1{print $2}\\' /data/input.csv | sort | uniq -c | sort -rn'",
      ),
  }),
  execute: async ({ command }) => {
    if (!sharedBash) {
      const { Bash } = await import("just-bash");
      sharedBash = new Bash();
    }
    const result = await sharedBash.exec(command);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  },
});
