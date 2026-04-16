import { defineConfig } from "tsup";
import { cpSync } from "fs";

export default defineConfig({
  entry: ["src/**/*.ts", "!src/**/*.test.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  splitting: false,
  clean: true,
  bundle: false,
  onSuccess: async () => {
    // Copy runtime assets that are loaded via fs.readFile at runtime
    cpSync("src/orchestrator/prompts", "dist/orchestrator/prompts", {
      recursive: true,
    });
    cpSync("src/worker/prompts", "dist/worker/prompts", { recursive: true });
    cpSync("src/skills/definitions", "dist/skills/definitions", {
      recursive: true,
    });
  },
});
