import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// The proxy delegates the actual cookie read/decrypt to getSessionFromRequest;
// mock it so we can drive the four perimeter outcomes directly.
vi.mock("@/src/lib/session", () => ({
  getSessionFromRequest: vi.fn(),
}));

import proxy from "../../proxy";
import { getSessionFromRequest } from "@/src/lib/session";

const mockGetSession = vi.mocked(getSessionFromRequest);

function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("proxy (auth perimeter)", () => {
  it("redirects an unauthenticated request for a protected route to /login, capturing ?next", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await proxy(requestFor("/tasks"));

    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/tasks");
  });

  it("lets an unauthenticated request reach a public route", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await proxy(requestFor("/login"));

    // NextResponse.next() carries no redirect, just the continue marker.
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects an authenticated request away from /login to /", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: true });

    const res = await proxy(requestFor("/login"));

    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("lets an authenticated request reach a protected route", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: true });

    const res = await proxy(requestFor("/tasks"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
