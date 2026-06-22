import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// rate-limit.ts keeps its failure log in module-level state, so each test needs
// a clean slate. vi.resetModules() drops the cached module and the dynamic
// import below re-evaluates it (failures = []). Fake timers let us drive the
// 60-second sliding window deterministically without real waits.
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isRateLimited / recordFailure", () => {
  it("is not rate limited with a clean history", async () => {
    const { isRateLimited } = await import("../../src/lib/rate-limit");
    expect(isRateLimited()).toBe(false);
  });

  it("stays unlocked at 4 failures (below the limit of 5)", async () => {
    const { isRateLimited, recordFailure } = await import("../../src/lib/rate-limit");
    for (let i = 0; i < 4; i++) recordFailure();
    expect(isRateLimited()).toBe(false);
  });

  it("locks out once 5 failures land inside the window", async () => {
    const { isRateLimited, recordFailure } = await import("../../src/lib/rate-limit");
    for (let i = 0; i < 5; i++) recordFailure();
    expect(isRateLimited()).toBe(true);
  });

  it("prunes failures older than the 60s window, then unlocks", async () => {
    const { isRateLimited, recordFailure } = await import("../../src/lib/rate-limit");
    for (let i = 0; i < 5; i++) recordFailure();
    expect(isRateLimited()).toBe(true);

    // The window is exclusive (now - t < 60_000), so once a full 60s elapses the
    // old failures fall outside it and are pruned on the next check.
    vi.advanceTimersByTime(60_000);
    expect(isRateLimited()).toBe(false);
  });

  it("keeps counting failures that are still within the window", async () => {
    const { isRateLimited, recordFailure } = await import("../../src/lib/rate-limit");
    for (let i = 0; i < 3; i++) recordFailure();
    vi.advanceTimersByTime(30_000); // half the window later
    for (let i = 0; i < 2; i++) recordFailure();

    // All 5 are still within 60s of "now", so the caller is locked out.
    expect(isRateLimited()).toBe(true);
  });
});
