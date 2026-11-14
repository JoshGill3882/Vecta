import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real logger runs; only its table write is stood in for, so these tests
// read exactly what reaches stdout.
vi.mock("@/src/server/services/logs", () => ({ writeLog: vi.fn(async () => ({})) }));

import { ConflictError, NotFoundError } from "@/src/server/errors";
import { flushLogs } from "@/src/server/logger";
import { writeLog } from "@/src/server/services/logs";
import { toActionError } from "@/src/shared/lib/result";

const GENERIC = { ok: false, error: "Something went wrong. Please try again." };
let lines: string[];

/** Every JSON line written to stdout since the test began.
 *
 * @returns The lines, parsed.
 */
function stdout(): Record<string, unknown>[] {
  return lines.map((line) => JSON.parse(line));
}

beforeEach(() => {
  lines = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  vi.mocked(writeLog).mockClear();
});

afterEach(async () => {
  await flushLogs();
  vi.restoreAllMocks();
});

describe("toActionError", () => {
  it.each([
    ["NotFoundError", new NotFoundError("Task", "t1"), "NOT_FOUND"],
    ["ConflictError", new ConflictError("A category named Work already exists"), "CONFLICT"],
  ])("returns a %s's own message and code, and logs nothing", (_, error, code) => {
    expect(toActionError(error)).toEqual({ ok: false, error: error.message, code });
    expect(lines).toEqual([]);
  });

  it("returns a generic message for an unexpected error, never its own", () => {
    expect(toActionError(new Error("relation Task does not exist"))).toEqual(GENERIC);
  });

  it("logs an unexpected error at error level, with its message and stack", async () => {
    toActionError(new Error("boom — DB down"));
    await flushLogs();

    expect(stdout()).toHaveLength(1);
    expect(stdout()[0]).toMatchObject({
      level: "error",
      event: "action.unexpected_error",
      detail: {
        error: {
          name: "Error",
          message: "boom — DB down",
          stack: expect.stringContaining("boom — DB down"),
        },
      },
    });
    expect(writeLog).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "operational", event: "action.unexpected_error" })
    );
  });

  it("no longer reports through console.error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    toActionError(new Error("boom"));

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logs something thrown that is not an Error as it was thrown", () => {
    expect(toActionError("a bare string")).toEqual(GENERIC);
    expect(stdout()[0]).toMatchObject({ detail: { error: "a bare string" } });
  });

  it("keeps credentials out of the log when the error carries a database URL", () => {
    toActionError(new Error("Can't reach postgresql://vecta:s3cret@db:5432/vecta"));

    expect(lines.join("")).not.toContain("s3cret");
  });
});
