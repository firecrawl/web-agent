import { tool } from "ai";
import { z } from "zod";

export const formatOutput = tool({
  description:
    "Format the final output as CSV, JSON, or text. Call this when you have collected all data and are ready to present results.",
  inputSchema: z.object({
    format: z.enum(["csv", "json", "text"]).describe("Output format"),
    data: z.unknown().describe("The data to format"),
    columns: z
      .array(z.string())
      .optional()
      .describe("Column names for CSV format"),
  }),
  execute: async ({ format, data, columns }) => {
    switch (format) {
      case "json":
        return { format: "json", content: JSON.stringify(data, null, 2) };
      case "csv": {
        const Papa = await import("papaparse");
        const rows = Array.isArray(data) ? data : [data];
        return { format: "csv", content: Papa.default.unparse(rows, { columns }) };
      }
      case "text":
        return {
          format: "text",
          content: typeof data === "string" ? data : JSON.stringify(data, null, 2),
        };
    }
  },
});
