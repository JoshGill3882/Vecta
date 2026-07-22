import { describe, it, expect, vi } from "vitest";

// proxy.ts imports the session module for its cookie read; this spec only wants
// the exported `config`, so stub the dependency rather than pulling iron-session
// and next/headers into a plain node environment.
vi.mock("@/src/lib/session", () => ({
  getSessionFromRequest: vi.fn(),
}));

import { GET } from "@/app/api/health/route";
import { config } from "../../proxy";

describe("GET /api/health", () => {
  it("returns 200 with an ok status", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });

  it("exposes nothing beyond the status", async () => {
    // The endpoint is unauthenticated and polled by anything that can reach the
    // port, so the payload must not grow to carry version, environment, or host
    // details — that is free reconnaissance.
    const body = await (await GET()).json();

    expect(Object.keys(body)).toEqual(["status"]);
  });
});

describe("/api/health and the auth perimeter", () => {
  // Next anchors proxy matchers internally, so anchor here too. It changes the
  // answer: unanchored, this pattern fails its negative lookahead at the leading
  // "/" and then re-matches from the second one, reporting /api/health as
  // protected when it is not.
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it("leaves /api/health outside the matcher, so no session is required", () => {
    expect(matcher.test("/api/health")).toBe(false);
  });

  it("still guards application routes", () => {
    expect(matcher.test("/tasks")).toBe(true);
  });
});
