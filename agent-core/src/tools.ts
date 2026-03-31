import { tool } from "ai";
import { z } from "zod";

// --- formatOutput ---

export const formatOutput = tool({
  description:
    "Format the final output as CSV, JSON, or text. Call this when you have collected all data and are ready to present results.",
  inputSchema: z.object({
    format: z.enum(["csv", "json", "text"]).describe("Output format"),
    data: z.unknown().describe("The data to format — can be a JSON string, object, array, or plain text"),
    columns: z
      .array(z.string())
      .optional()
      .describe("Column names for CSV format"),
  }),
  execute: async ({ format, data, columns }) => {
    switch (format) {
      case "json": {
        if (typeof data === "string") {
          try {
            JSON.parse(data);
            return { format: "json", content: data };
          } catch {
            return { format: "json", content: JSON.stringify(data, null, 2) };
          }
        }
        return { format: "json", content: JSON.stringify(data, null, 2) };
      }
      case "csv": {
        const Papa = await import("papaparse");
        let rows: unknown[];
        if (typeof data === "string") {
          try {
            rows = JSON.parse(data);
            if (!Array.isArray(rows)) rows = [rows];
          } catch {
            return { format: "csv", content: data };
          }
        } else {
          rows = Array.isArray(data) ? data : [data];
        }
        return {
          format: "csv",
          content: Papa.default.unparse(rows as Record<string, unknown>[], { columns }),
        };
      }
      case "text":
        return {
          format: "text",
          content: typeof data === "string" ? data : JSON.stringify(data, null, 2),
        };
    }
  },
});

// --- bashExec ---

type BashInstance = {
  exec: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
};

const g = globalThis as unknown as { __firecrawlBash?: BashInstance };

function getSharedBash(): BashInstance | null {
  return g.__firecrawlBash ?? null;
}

function setSharedBash(b: BashInstance) {
  g.__firecrawlBash = b;
}

export async function initBashWithFiles(files: Record<string, string>) {
  const { Bash } = await import("just-bash");
  const bash = new Bash();
  setSharedBash(bash);
  for (const [filePath, content] of Object.entries(files)) {
    await bash.exec(`mkdir -p "$(dirname "${filePath}")"`);
    await bash.exec(
      `cat > "${filePath}" << 'FIRECRAWL_EOF'\n${content}\nFIRECRAWL_EOF`,
    );
  }
}

export async function listBashFiles(): Promise<{ path: string; size: number }[]> {
  const bash = getSharedBash();
  if (!bash) return [];
  const result = await bash.exec("ls -lR /data 2>/dev/null");
  if (result.exitCode !== 0 || !result.stdout.trim()) return [];
  const files: { path: string; size: number }[] = [];
  let currentDir = "/data";
  for (const line of result.stdout.split("\n")) {
    if (line.endsWith(":")) {
      currentDir = line.slice(0, -1);
    } else if (line.trim() && !line.startsWith("total")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const size = parseInt(parts[4]) || 0;
        const name = parts.slice(8).join(" ") || parts[parts.length - 1];
        if (size > 0 && name) files.push({ path: `${currentDir}/${name}`, size });
      }
    }
  }
  return files;
}

export async function readBashFile(filePath: string): Promise<string> {
  const bash = getSharedBash();
  if (!bash) return "";
  const result = await bash.exec(`cat "${filePath}"`);
  return result.stdout;
}

export const bashExec = tool({
  description:
    "Execute a bash command in a sandboxed environment with a persistent filesystem. Available tools: jq, awk, sed, grep, sort, uniq, wc, head, tail, cut, tr, paste, cat, echo, printf, expr, ls, mkdir, rm, cp, mv, tee, xargs. NOT available: node, python, curl, wget, npm, pip, bc. For math use awk (e.g. awk 'BEGIN{print 10*1.5}') or expr. The filesystem persists between calls — write files in one call, read them in the next. Use jq for JSON processing, awk for CSV/text processing. If a CSV was uploaded, it's at /data/input.csv.",
  inputSchema: z.object({
    command: z
      .string()
      .describe(
        "The bash command to execute. Examples: 'cat /data/input.csv | head -5', 'echo data | jq .', 'awk -F, \\'NR>1{print $2}\\' /data/input.csv | sort | uniq -c | sort -rn'",
      ),
  }),
  execute: async ({ command }) => {
    let bash = getSharedBash();
    if (!bash) {
      const { Bash } = await import("just-bash");
      bash = new Bash();
      setSharedBash(bash);
    }
    const result = await bash.exec(command);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  },
});
