import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* Loading the log service opens the database, and `src/server/db.ts` throws as
   it loads when DATABASE_URL is missing. This stands in for that: the service
   cannot even be imported. */
vi.mock("@/src/server/services/logs", () => {
  throw new Error("DATABASE_URL is not set.");
});

import { flushLogs, logger } from "@/src/server/logger";

let lines: string[];

beforeEach(() => {
  lines = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logger with no database", () => {
  it("loads without touching the database", async () => {
    // Importing the logger above succeeded, which is what this pins: the log
    // service is loaded on the first table write, not when the logger is.
    expect(logger.info).toBeTypeOf("function");
  });

  it("still writes the entry to stdout, and reports the table write failing", async () => {
    expect(() =>
      logger.error("server.config_invalid", "SESSION_SECRET is too short")
    ).not.toThrow();
    await flushLogs();

    const parsed = lines.map((line) => JSON.parse(line));
    expect(parsed[0]).toMatchObject({ event: "server.config_invalid", level: "error" });
    expect(parsed[1]).toMatchObject({
      event: "log.write_failed",
      detail: { entryEvent: "server.config_invalid" },
    });
    expect(JSON.stringify(parsed[1].detail)).toContain("DATABASE_URL is not set.");
  });

  it("keeps writing to stdout for every later entry too, without throwing", async () => {
    logger.warn("test.one", "First");
    logger.warn("test.two", "Second");
    await flushLogs();

    const events = lines.map((line) => JSON.parse(line).event);
    expect(events.filter((e) => e.startsWith("test."))).toEqual(["test.one", "test.two"]);
    expect(events.filter((e) => e === "log.write_failed")).toHaveLength(2);
  });
});
