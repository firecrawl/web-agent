import { tool } from "ai";
import { z } from "zod";

export const bashExec = tool({
  description:
    "Execute a bash command in a sandboxed environment. Use for data processing: jq, awk, sed, grep, sort, uniq, wc, etc. The filesystem persists between calls — write files in one call, read them in the next. Supports curl for HTTP requests, and standard unix commands.",
  inputSchema: z.object({
    command: z
      .string()
      .describe(
        "The bash command to execute. Can be multi-line. Examples: 'echo hello', 'jq .pricing data.json', 'curl -s https://api.example.com | jq .'",
      ),
  }),
  execute: async ({ command }) => {
    const { Bash } = await import("just-bash");
    const bash = new Bash();
    const result = await bash.exec(command);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  },
});
