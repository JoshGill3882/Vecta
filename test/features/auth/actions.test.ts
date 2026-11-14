import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Fakes for the action's collaborators ────────────────────────────────────
// vi.mock is hoisted above the imports, so these stand in before the actions
// (and the modules they pull in) are loaded. The auth service is faked whole:
// how a password is checked and recorded is tested against the service itself,
// so these tests cover only what each outcome turns into for the form.

vi.mock("@/src/server/services/auth", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Real redirect() throws to unwind rendering; mirror that so we can assert both
// that it was called and that nothing after it runs.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { loginAction } from "@/src/features/auth/login-actions";
import { logoutAction } from "@/src/features/auth/logout-actions";
import { signIn, signOut } from "@/src/server/services/auth";
import { redirect } from "next/navigation";

const mockSignIn = vi.mocked(signIn);
const mockSignOut = vi.mocked(signOut);
const mockRedirect = vi.mocked(redirect);

/** Builds the form data the login action expects.
 *
 * @param password The password field.
 * @param next Where to return to after signing in, when present.
 * @returns Form data ready to submit.
 */
function form(password: string, next?: string): FormData {
  const fd = new FormData();
  fd.set("password", password);
  if (next !== undefined) fd.set("next", next);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSignIn.mockResolvedValue("signed_in");
});

describe("loginAction", () => {
  it("passes the submitted password to the auth service", async () => {
    await expect(loginAction({}, form("typed-password"))).rejects.toThrow("REDIRECT:/");

    expect(mockSignIn).toHaveBeenCalledWith("typed-password");
  });

  it("passes an empty password when the field is missing", async () => {
    mockSignIn.mockResolvedValue("wrong_password");

    await loginAction({}, new FormData());

    expect(mockSignIn).toHaveBeenCalledWith("");
  });

  it("asks the user to wait when rate limited", async () => {
    mockSignIn.mockResolvedValue("rate_limited");

    const result = await loginAction({}, form("anything"));

    expect(result).toEqual({ error: "Too many attempts. Retry in a minute" });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns an error on the wrong password", async () => {
    mockSignIn.mockResolvedValue("wrong_password");

    const result = await loginAction({}, form("definitely-wrong"));

    expect(result).toEqual({ error: "Password Invalid" });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects home once signed in", async () => {
    // Success path ends in redirect("/"), which our fake throws to unwind.
    await expect(loginAction({}, form("right"))).rejects.toThrow("REDIRECT:/");

    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("returns to a safe `next` path on success", async () => {
    await expect(loginAction({}, form("right", "/tasks/42"))).rejects.toThrow("REDIRECT:/tasks/42");

    expect(mockRedirect).toHaveBeenCalledWith("/tasks/42");
  });

  it("ignores an unsafe `next` (open-redirect guard) and falls back to /", async () => {
    await expect(loginAction({}, form("right", "//evil.example.com"))).rejects.toThrow(
      "REDIRECT:/"
    );

    expect(mockRedirect).toHaveBeenCalledWith("/");
  });
});

describe("logoutAction", () => {
  it("signs out and redirects to /login", async () => {
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");

    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
