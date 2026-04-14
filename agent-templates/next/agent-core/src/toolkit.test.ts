import { describe, it, expect } from "vitest";
import { wrapInteractWithTimeout } from "./toolkit";

describe("wrapInteractWithTimeout", () => {
  it("resolves with a timeout envelope when execute hangs", async () => {
    const hanging = {
      description: "stub",
      execute: () => new Promise<unknown>(() => {}),
    };
    const wrapped = wrapInteractWithTimeout(hanging, 50)!;
    const t0 = Date.now();
    const out = (await wrapped.execute!(
      { url: "https://x.test", prompt: "p" },
    )) as { timedOut?: boolean; error?: string; url?: string; prompt?: string };
    expect(out.timedOut).toBe(true);
    expect(out.error).toMatch(/timed out/i);
    expect(out.url).toBe("https://x.test");
    expect(out.prompt).toBe("p");
    expect(Date.now() - t0).toBeLessThan(500);
  });

  it("passes through fast results untouched", async () => {
    const fast = {
      description: "stub",
      execute: async () => ({ output: "ok" }),
    };
    const wrapped = wrapInteractWithTimeout(fast, 1000)!;
    const out = await wrapped.execute!({});
    expect(out).toEqual({ output: "ok" });
  });

  it("returns the tool unchanged when timeoutMs <= 0", () => {
    const tool = { execute: async () => "ok" };
    expect(wrapInteractWithTimeout(tool, 0)).toBe(tool);
    expect(wrapInteractWithTimeout(tool, -1)).toBe(tool);
  });

  it("returns undefined when given undefined", () => {
    expect(wrapInteractWithTimeout(undefined, 1000)).toBeUndefined();
  });

  it("aborts the upstream signal on timeout", async () => {
    let upstreamAbortedWithin: boolean | undefined;
    const hanging = {
      execute: (_input: unknown, opts?: unknown) => {
        const sig = (opts as { abortSignal?: AbortSignal } | undefined)?.abortSignal;
        return new Promise<unknown>((resolve) => {
          sig?.addEventListener("abort", () => {
            upstreamAbortedWithin = true;
            resolve({ aborted: true });
          }, { once: true });
        });
      },
    };
    const wrapped = wrapInteractWithTimeout(hanging, 30)!;
    const out = (await wrapped.execute!({})) as { timedOut?: boolean };
    expect(out.timedOut).toBe(true);
    // Yield once so the abort-listener inside `execute` has a chance to run.
    await new Promise((r) => setTimeout(r, 10));
    expect(upstreamAbortedWithin).toBe(true);
  });
});
