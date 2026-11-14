import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/server/start-up", () => ({ startUp: vi.fn(async () => {}) }));

import { register } from "@/instrumentation";
import { startUp } from "@/src/server/start-up";

beforeEach(() => {
  vi.mocked(startUp).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("register", () => {
  it("starts up with the process environment in the Node.js runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    await register();

    expect(startUp).toHaveBeenCalledOnce();
    expect(startUp).toHaveBeenCalledWith(process.env);
  });

  it("does nothing in the Edge runtime, which cannot load the logger", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();

    expect(startUp).not.toHaveBeenCalled();
  });

  it("passes on a refusal to start, so Next aborts start-up", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.mocked(startUp).mockRejectedValueOnce(
      new Error("SESSION_SECRET must be at least 32 characters long.")
    );

    await expect(register()).rejects.toThrow("SESSION_SECRET must be at least 32 characters long.");
  });
});
