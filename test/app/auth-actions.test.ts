import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Fakes for the action's collaborators ────────────────────────────────────
// vi.mock is hoisted above the imports, so these stand in before the actions
// (and the modules they pull in) are loaded.

vi.mock("@/src/lib/rate-limit", () => ({
  isRateLimited: vi.fn(() => false),
  recordFailure: vi.fn(),
}));

vi.mock("@/src/lib/session", () => ({
  createSession: vi.fn(),
  destroySession: vi.fn(),
}));

// Real redirect() throws to unwind rendering; mirror that so we can assert both
// that it was called and that nothing after it runs.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { loginAction } from "../../app/login/actions";
import { logoutAction } from "../../app/logout/actions";
import { isRateLimited, recordFailure } from "@/src/lib/rate-limit";
import { createSession, destroySession } from "@/src/lib/session";
import { redirect } from "next/navigation";

const mockIsRateLimited = vi.mocked(isRateLimited);
const mockRecordFailure = vi.mocked(recordFailure);
const mockCreateSession = vi.mocked(createSession);
const mockDestroySession = vi.mocked(destroySession);
const mockRedirect = vi.mocked(redirect);

const PASSWORD = "correct-horse-battery-staple";

function form(password: string): FormData {
  const fd = new FormData();
  fd.set("password", password);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsRateLimited.mockReturnValue(false);
  process.env.ADMIN_PASSWORD = PASSWORD;
});

describe("loginAction", () => {
  it("rejects while rate limited without checking the password", async () => {
    mockIsRateLimited.mockReturnValue(true);

    const result = await loginAction({}, form(PASSWORD));

    expect(result).toEqual({ error: "Too many attempts. Retry in a minute" });
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockRecordFailure).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("records a failure and returns an error on the wrong password", async () => {
    const result = await loginAction({}, form("definitely-wrong"));

    expect(result).toEqual({ error: "Password Invalid" });
    expect(mockRecordFailure).toHaveBeenCalledOnce();
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("treats a missing password field as a failed attempt", async () => {
    const result = await loginAction({}, new FormData());

    expect(result).toEqual({ error: "Password Invalid" });
    expect(mockRecordFailure).toHaveBeenCalledOnce();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("rejects a value that merely shares the password's first few characters", async () => {
    // Regression guard: the full password is compared (SHA-256 digest), so a
    // prefix must NOT pass. The old Buffer.alloc(5, …) comparison accepted this.
    const result = await loginAction({}, form(PASSWORD.slice(0, 5)));

    expect(result).toEqual({ error: "Password Invalid" });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("creates a session and redirects home on the correct password", async () => {
    // Success path ends in redirect("/"), which our fake throws to unwind.
    await expect(loginAction({}, form(PASSWORD))).rejects.toThrow("REDIRECT:/");

    expect(mockCreateSession).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith("/");
    expect(mockRecordFailure).not.toHaveBeenCalled();
  });
});

describe("logoutAction", () => {
  it("destroys the session and redirects to /login", async () => {
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");

    expect(mockDestroySession).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
