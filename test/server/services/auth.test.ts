import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Fakes for the service's collaborators ───────────────────────────────────
// The logger is the real one, so the tests read what an attempt actually writes
// to stdout and hands to the Log table; only the table itself is stood in for.

vi.mock("@/src/server/rate-limit", () => ({
  isRateLimited: vi.fn(() => false),
  recordFailure: vi.fn(),
}));

vi.mock("@/src/shared/lib/session", () => ({
  createSession: vi.fn(),
  destroySession: vi.fn(),
}));

vi.mock("@/src/server/services/logs", () => ({ writeLog: vi.fn(async () => ({})) }));

import { signIn, signOut } from "@/src/server/services/auth";
import { flushLogs } from "@/src/server/logger";
import { isRateLimited, recordFailure } from "@/src/server/rate-limit";
import { createSession, destroySession } from "@/src/shared/lib/session";
import { writeLog } from "@/src/server/services/logs";

const mockIsRateLimited = vi.mocked(isRateLimited);
const mockRecordFailure = vi.mocked(recordFailure);
const mockCreateSession = vi.mocked(createSession);
const mockDestroySession = vi.mocked(destroySession);
const mockWriteLog = vi.mocked(writeLog);

const PASSWORD = "correct-horse-battery-staple";
const WRONG = "tr0ub4dor-and-3";

let lines: string[];

/** Every entry written to stdout since the test began.
 *
 * @returns The lines, parsed.
 */
function stdout(): Record<string, unknown>[] {
  return lines.map((line) => JSON.parse(line));
}

/** Everything the logger produced, on stdout and for the table, as one string.
 *
 * @returns The raw stdout lines followed by each table write, serialised.
 */
async function everythingLogged(): Promise<string> {
  await flushLogs();
  return lines.join("") + JSON.stringify(mockWriteLog.mock.calls);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsRateLimited.mockReturnValue(false);
  process.env.ADMIN_PASSWORD = PASSWORD;
  lines = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
});

afterEach(async () => {
  await flushLogs();
  vi.restoreAllMocks();
});

describe("signIn: the outcome", () => {
  it("refuses while rate limited, without checking the password", async () => {
    mockIsRateLimited.mockReturnValue(true);

    expect(await signIn(PASSWORD)).toBe("rate_limited");
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockRecordFailure).not.toHaveBeenCalled();
  });

  it("records a failure against the limit on the wrong password", async () => {
    expect(await signIn(WRONG)).toBe("wrong_password");
    expect(mockRecordFailure).toHaveBeenCalledOnce();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("treats an empty password as a wrong one", async () => {
    expect(await signIn("")).toBe("wrong_password");
    expect(mockRecordFailure).toHaveBeenCalledOnce();
  });

  it("rejects a value that merely shares the password's first few characters", async () => {
    // The full password is compared, as a SHA-256 digest, so a prefix must not pass.
    expect(await signIn(PASSWORD.slice(0, 5))).toBe("wrong_password");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("creates a session on the correct password", async () => {
    expect(await signIn(PASSWORD)).toBe("signed_in");
    expect(mockCreateSession).toHaveBeenCalledOnce();
    expect(mockRecordFailure).not.toHaveBeenCalled();
  });
});

describe("signIn: what it records", () => {
  it("records a successful sign-in as activity, with no detail", async () => {
    await signIn(PASSWORD);
    await flushLogs();

    expect(stdout()).toEqual([
      {
        time: expect.any(String),
        kind: "activity",
        level: "info",
        event: "auth.signed_in",
        message: "Signed in",
      },
    ]);
    expect(mockWriteLog).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "activity", event: "auth.signed_in" })
    );
  });

  it("records a wrong password as a warning giving only the reason", async () => {
    await signIn(WRONG);

    expect(stdout()).toEqual([
      {
        time: expect.any(String),
        kind: "activity",
        level: "warn",
        event: "auth.sign_in_failed",
        message: "Sign-in failed",
        detail: { reason: "wrong_password" },
      },
    ]);
  });

  it("records a refused attempt as a warning giving only the reason", async () => {
    mockIsRateLimited.mockReturnValue(true);

    await signIn(WRONG);

    expect(stdout()).toEqual([
      expect.objectContaining({
        level: "warn",
        event: "auth.sign_in_failed",
        detail: { reason: "rate_limited" },
      }),
    ]);
  });

  it.each([
    ["a wrong password", false],
    ["a refused attempt", true],
  ])("never records %s, any part of it, or its digest", async (_, rateLimited) => {
    mockIsRateLimited.mockReturnValue(rateLimited);

    await signIn(WRONG);
    const logged = await everythingLogged();

    expect(logged).not.toContain(WRONG);
    for (const part of [WRONG.slice(0, 4), WRONG.slice(4, 8), WRONG.slice(-4)]) {
      expect(logged).not.toContain(part);
    }
    expect(logged).not.toContain(createHash("sha256").update(WRONG).digest("hex"));
    expect(logged).not.toMatch(/length/i);
  });

  it("never records the configured password on success", async () => {
    await signIn(PASSWORD);

    expect(await everythingLogged()).not.toContain(PASSWORD);
  });
});

describe("signOut", () => {
  it("destroys the session and records the sign-out", async () => {
    await signOut();
    await flushLogs();

    expect(mockDestroySession).toHaveBeenCalledOnce();
    expect(stdout()).toEqual([
      expect.objectContaining({ kind: "activity", level: "info", event: "auth.signed_out" }),
    ]);
  });
});
