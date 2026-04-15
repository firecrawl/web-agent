import { describe, it, expect } from "vitest";
import { stripInteractNulls, wrapInteractWithTimeout } from "./toolkit";

describe("wrapInteractWithTimeout", () => {
  it("resolves with a timeout envelope when execute hangs", async () => {
    const hanging = {
      description: "stub",
      execute: (_input: unknown, _opts?: unknown) => new Promise<unknown>(() => {}),
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
      execute: async (_input: unknown, _opts?: unknown) => ({ output: "ok" }),
    };
    const wrapped = wrapInteractWithTimeout(fast, 1000)!;
    const out = await wrapped.execute!({});
    expect(out).toEqual({ output: "ok" });
  });

  it("still wraps execute (for null-stripping) when timeoutMs <= 0", async () => {
    // Contract changed: we strip nulls on every happy path, timeout or not.
    // The wrapper returns a new object so the `execute` can apply stripping;
    // the original tool reference is preserved for other fields via spread.
    const tool = {
      description: "stub",
      execute: async (_i: unknown, _o?: unknown) => ({ output: "ok", stdout: "" }),
    };
    const wrapped0 = wrapInteractWithTimeout(tool, 0)!;
    const wrappedNeg = wrapInteractWithTimeout(tool, -1)!;
    expect(wrapped0.description).toBe("stub");
    expect(wrappedNeg.description).toBe("stub");
    expect(await wrapped0.execute!({})).toEqual({ output: "ok" });
    expect(await wrappedNeg.execute!({})).toEqual({ output: "ok" });
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

  it("strips null, undefined, and empty-string fields from the happy-path result", async () => {
    const fast = {
      description: "stub",
      execute: async (_input: unknown, _opts?: unknown) => ({
        success: true,
        output: "Here are the headphones…",
        result: null,
        stdout: "",
        stderr: null,
        exitCode: null,
        killed: false,
        liveViewUrl: "https://fc/live/abc",
      }),
    };
    const wrapped = wrapInteractWithTimeout(fast, 1000)!;
    const out = (await wrapped.execute!({})) as Record<string, unknown>;
    expect(out).toEqual({
      success: true,
      output: "Here are the headphones…",
      killed: false,
      liveViewUrl: "https://fc/live/abc",
    });
    expect("result" in out).toBe(false);
    expect("stdout" in out).toBe(false);
    expect("stderr" in out).toBe(false);
    expect("exitCode" in out).toBe(false);
  });

  it("preserves the timeout envelope fields (does not strip error/timedOut)", async () => {
    const hanging = {
      description: "stub",
      execute: (_input: unknown, _opts?: unknown) => new Promise<unknown>(() => {}),
    };
    const wrapped = wrapInteractWithTimeout(hanging, 20)!;
    const out = (await wrapped.execute!({ url: "https://x.test", prompt: "p" })) as {
      timedOut?: boolean;
      error?: string;
      url?: string;
      prompt?: string;
    };
    expect(out.timedOut).toBe(true);
    expect(out.error).toMatch(/timed out/i);
    expect(out.url).toBe("https://x.test");
    expect(out.prompt).toBe("p");
  });

  it("strips nulls even when the timeout is disabled (timeoutMs = 0)", async () => {
    const fast = {
      description: "stub",
      execute: async (_input: unknown, _opts?: unknown) => ({
        output: "ok",
        result: null,
        stdout: "",
      }),
    };
    const wrapped = wrapInteractWithTimeout(fast, 0)!;
    const out = (await wrapped.execute!({})) as Record<string, unknown>;
    expect(out).toEqual({ output: "ok" });
  });
});

describe("stripInteractNulls", () => {
  it("removes null, undefined, and empty-string top-level fields", () => {
    expect(
      stripInteractNulls({ a: 1, b: null, c: undefined, d: "", e: "x" }),
    ).toEqual({ a: 1, e: "x" });
  });

  it("preserves empty arrays, empty objects, and false/0 values", () => {
    expect(
      stripInteractNulls({ arr: [], obj: {}, falsey: false, zero: 0 }),
    ).toEqual({ arr: [], obj: {}, falsey: false, zero: 0 });
  });

  it("passes through non-objects unchanged", () => {
    expect(stripInteractNulls(null)).toBe(null);
    expect(stripInteractNulls(undefined)).toBe(undefined);
    expect(stripInteractNulls("hello")).toBe("hello");
    expect(stripInteractNulls(42)).toBe(42);
    expect(stripInteractNulls([1, null, 3])).toEqual([1, null, 3]);
  });

  it("does not recurse into nested objects (top-level only)", () => {
    // Nested nulls carry meaning (e.g. metadata.language=null) and stripping
    // them could break downstream consumers that check key presence.
    const result = stripInteractNulls({
      metadata: { language: null, title: "hi" },
      stdout: "",
    }) as { metadata: Record<string, unknown>; stdout?: string };
    expect(result.metadata).toEqual({ language: null, title: "hi" });
    expect(result.stdout).toBeUndefined();
  });
});
