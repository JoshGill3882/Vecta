import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Replace the Next.js-only dependencies with controllable fakes ───────────
//
// vi.mock calls are hoisted to the top of the file by Vitest, so they take
// effect before session.ts (and its imports) are loaded below.

// cookies() just needs to hand *something* to getIronSession; we control the
// session via the iron-session mock, so an empty object is enough here.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({})),
}));

// The real redirect() throws internally to stop rendering. We mirror that so a
// test can both assert it was called and confirm code after it doesn't run.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

// The dependency we actually want to vary per test: what session comes back.
vi.mock("iron-session", () => ({
  getIronSession: vi.fn(),
}));

// Import the code under test *after* the mocks are declared.
import {
  getSession,
  requireSession,
  createSession,
  destroySession,
  getSessionFromRequest,
} from "../../src/lib/session";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { redirect } from "next/navigation";

// vi.mocked() is just a typing helper: it tells TS these are mock functions so
// .mockResolvedValue / .toHaveBeenCalledWith are available.
const mockGetIronSession = vi.mocked(getIronSession);
const mockRedirect = vi.mocked(redirect);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSession", () => {
  it("returns null for a brand-new (empty) session", async () => {
    // iron-session returns {} when there's no valid cookie — NOT null.
    mockGetIronSession.mockResolvedValue({} as never);

    expect(await getSession()).toBeNull();
  });

  it("returns null when the session exists but isn't logged in", async () => {
    mockGetIronSession.mockResolvedValue({ isLoggedIn: false } as never);

    expect(await getSession()).toBeNull();
  });

  it("returns the session object when logged in", async () => {
    const session = { isLoggedIn: true };
    mockGetIronSession.mockResolvedValue(session as never);

    expect(await getSession()).toBe(session);
  });
});

describe("requireSession", () => {
  it("redirects to /login when there is no valid session", async () => {
    mockGetIronSession.mockResolvedValue({ isLoggedIn: false } as never);

    // Our fake redirect throws, so the call rejects — that's the assertion.
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("returns the session and does NOT redirect when logged in", async () => {
    const session = { isLoggedIn: true };
    mockGetIronSession.mockResolvedValue(session as never);

    const result = await requireSession();

    // Expect the Redirect not to be called as the session should be returned correctly
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBe(session);
  });
});

describe("createSession", () => {
  it("marks the session logged in and persists it", async () => {
    // iron-session hands back a fresh, logged-out session object with a save().
    const save = vi.fn();
    const session = { isLoggedIn: false, save };
    mockGetIronSession.mockResolvedValue(session as never);

    await createSession();

    expect(session.isLoggedIn).toBe(true);
    expect(save).toHaveBeenCalledOnce(); // the encrypted Set-Cookie is written
  });
});

describe("destroySession", () => {
  it("destroys the underlying iron-session", async () => {
    // destroy() wipes the data and emits the expiring Set-Cookie header.
    const destroy = vi.fn();
    mockGetIronSession.mockResolvedValue({ isLoggedIn: true, destroy } as never);

    await destroySession();

    expect(destroy).toHaveBeenCalledOnce();
  });
});

describe("getSessionFromRequest", () => {
  // The proxy reads the cookie off the request rather than via next/headers, so
  // getIronSession is called with the (req, res, options) overload.
  const fakeReq = {} as NextRequest;

  it("returns the session data when logged in", async () => {
    const session = { isLoggedIn: true };
    mockGetIronSession.mockResolvedValue(session as never);

    expect(await getSessionFromRequest(fakeReq)).toBe(session);
  });

  it("returns null when the session isn't logged in", async () => {
    mockGetIronSession.mockResolvedValue({ isLoggedIn: false } as never);

    expect(await getSessionFromRequest(fakeReq)).toBeNull();
  });
});
