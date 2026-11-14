import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/server/services/logs", () => ({ writeLog: vi.fn(async () => ({})) }));

import { writeLog } from "@/src/server/services/logs";
import { DEFAULT_LOG_LEVEL, flushLogs, isLogLevel, logger } from "@/src/server/logger";
import { REDACTED } from "@/src/server/log-detail";
import { LOG_LEVELS } from "@/src/shared/lib/schemas/logs";

const write = vi.mocked(writeLog);
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
  write.mockReset();
  write.mockResolvedValue({} as never);
  vi.unstubAllEnvs();
});

afterEach(async () => {
  await flushLogs();
  vi.restoreAllMocks();
});

describe("logger: stdout", () => {
  it.each([...LOG_LEVELS])("writes a %s entry as one JSON line", (level) => {
    vi.stubEnv("LOG_LEVEL", "debug");
    logger[level]("test.event", "Something happened", { id: "t1" });

    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith("\n")).toBe(true);
    expect(lines[0].trimEnd()).not.toContain("\n");
    expect(stdout()[0]).toEqual({
      time: expect.any(String),
      level,
      event: "test.event",
      message: "Something happened",
      detail: { id: "t1" },
    });
  });

  it("stamps each line with the time as an ISO string", () => {
    logger.info("test.event", "Timed");
    expect(new Date(stdout()[0].time as string).toISOString()).toBe(stdout()[0].time);
  });

  it("leaves detail out of the line when there is none", () => {
    logger.info("test.event", "No context");
    expect(stdout()[0]).not.toHaveProperty("detail");
  });

  it("writes the line even when the table write fails", async () => {
    write.mockRejectedValue(new Error("database is locked"));
    logger.error("test.event", "Still on stdout");
    await flushLogs();

    expect(stdout()[0]).toMatchObject({ event: "test.event", message: "Still on stdout" });
  });
});

describe("logger: minimum level", () => {
  it("defaults to info", () => {
    expect(DEFAULT_LOG_LEVEL).toBe("info");
    logger.debug("test.debug", "Hidden");
    logger.info("test.info", "Shown");

    expect(stdout().map((l) => l.event)).toEqual(["test.info"]);
  });

  it.each([
    ["debug", ["debug", "info", "warn", "error"]],
    ["info", ["info", "warn", "error"]],
    ["warn", ["warn", "error"]],
    ["error", ["error"]],
  ])("at %s, records %j and nothing below", async (minimum, shown) => {
    vi.stubEnv("LOG_LEVEL", minimum);
    for (const level of LOG_LEVELS) logger[level](`test.${level}`, level);
    await flushLogs();

    expect(stdout().map((l) => l.level)).toEqual(shown);
    expect(write.mock.calls.map(([entry]) => entry.level)).toEqual(shown);
  });

  it.each(["verbose", "INFO", ""])("falls back to info for an invalid LOG_LEVEL of %j", (value) => {
    vi.stubEnv("LOG_LEVEL", value);
    logger.debug("test.debug", "Hidden");
    logger.info("test.info", "Shown");

    expect(stdout().map((l) => l.event)).toEqual(["test.info"]);
  });

  it("reads LOG_LEVEL as each entry is logged, not once", () => {
    logger.debug("test.before", "Hidden");
    vi.stubEnv("LOG_LEVEL", "debug");
    logger.debug("test.after", "Shown");

    expect(stdout().map((l) => l.event)).toEqual(["test.after"]);
  });
});

describe("isLogLevel", () => {
  it.each([...LOG_LEVELS])("accepts %s", (level) => {
    expect(isLogLevel(level)).toBe(true);
  });

  it.each(["verbose", "Info", "", undefined, 3])("rejects %j", (value) => {
    expect(isLogLevel(value)).toBe(false);
  });
});

describe("logger: the Log table", () => {
  it("writes the entry as an operational one", async () => {
    logger.warn("test.event", "Something odd", { id: "t1" });
    await flushLogs();

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({
      kind: "operational",
      level: "warn",
      event: "test.event",
      message: "Something odd",
      detail: { id: "t1" },
    });
  });

  it("returns to the caller without waiting for the write", async () => {
    let finish: () => void = () => {};
    write.mockReturnValue(new Promise((resolve) => (finish = () => resolve({} as never))));

    const returned = logger.info("test.event", "Quick");

    expect(returned).toBeUndefined();
    expect(lines).toHaveLength(1);
    let flushed = false;
    const flushing = flushLogs().then(() => (flushed = true));
    await Promise.resolve();
    expect(flushed).toBe(false);

    finish();
    await flushing;
    expect(flushed).toBe(true);
  });

  it("reports a failed write on stdout, once, without telling the caller", async () => {
    write.mockRejectedValue(new Error("database is locked"));

    expect(() => logger.error("test.event", "Something broke")).not.toThrow();
    await flushLogs();

    expect(write).toHaveBeenCalledTimes(1);
    expect(stdout()).toHaveLength(2);
    expect(stdout()[1]).toMatchObject({
      level: "error",
      event: "log.write_failed",
      detail: { entryEvent: "test.event", error: { message: "database is locked" } },
    });
  });

  it("never writes its own failure to the table, so a broken database cannot loop", async () => {
    write.mockRejectedValue(new Error("no such table: Log"));
    logger.error("test.one", "First");
    logger.error("test.two", "Second");
    await flushLogs();
    await flushLogs();

    expect(write.mock.calls.map(([entry]) => entry.event)).toEqual(["test.one", "test.two"]);
  });

  it("does not retry a failed write", async () => {
    write.mockRejectedValueOnce(new Error("busy"));
    logger.info("test.event", "Once");
    await flushLogs();

    expect(write).toHaveBeenCalledTimes(1);
  });
});

describe("logger: redaction reaches both destinations", () => {
  it("hides sensitive detail on stdout and in the table write", async () => {
    logger.error("auth.sign_in_failed", "Sign-in failed", {
      password: "hunter2",
      DATABASE_URL: "postgresql://vecta:s3cret@db:5432/vecta",
    });
    await flushLogs();

    const expected = { password: REDACTED, DATABASE_URL: `postgresql://${REDACTED}@db:5432/vecta` };
    expect(stdout()[0].detail).toEqual(expected);
    expect(write.mock.calls[0][0].detail).toEqual(expected);
    expect(lines.join("")).not.toMatch(/hunter2|s3cret/);
  });

  it("removes URL credentials from the message too", async () => {
    logger.error("db.unreachable", "Can't reach postgres://vecta:s3cret@db:5432/vecta");
    await flushLogs();

    expect(stdout()[0].message).toBe(`Can't reach postgres://${REDACTED}@db:5432/vecta`);
    expect(write.mock.calls[0][0].message).toBe(stdout()[0].message);
  });

  it("spells out an error in detail rather than writing it as {}", () => {
    logger.error("test.event", "Failed", { error: new Error("boom") });

    expect(stdout()[0].detail).toMatchObject({
      error: { name: "Error", message: "boom", stack: expect.stringContaining("boom") },
    });
  });

  it("logs detail it cannot prepare as a note, rather than throwing", () => {
    const detail = Object.defineProperty({}, "broken", {
      enumerable: true,
      get() {
        throw new Error("getter failed");
      },
    });

    expect(() => logger.error("test.event", "Odd detail", detail)).not.toThrow();
    expect(stdout()[0].detail).toEqual({
      unprepared: "The detail recorded with this entry could not be prepared",
    });
  });
});
