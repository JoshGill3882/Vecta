import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushLogs, logger } from "@/src/server/logger";
import { REDACTED } from "@/src/server/log-detail";
import { listLogs } from "@/src/server/services/logs";

beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logger (integration)", () => {
  it("writes each entry to the Log table as an operational one", async () => {
    logger.error("action.unexpected_error", "An action failed unexpectedly", {
      error: new Error("boom"),
    });
    await flushLogs();

    const [entry] = await listLogs();
    expect(entry).toMatchObject({
      kind: "operational",
      level: "error",
      event: "action.unexpected_error",
      message: "An action failed unexpectedly",
      detail: { error: { name: "Error", message: "boom" } },
    });
  });

  it("stores redacted detail, so the secret never reaches the table", async () => {
    logger.warn("test.event", "With a secret", { sessionSecret: "x".repeat(32) });
    await flushLogs();

    const [entry] = await listLogs();
    expect(entry.detail).toEqual({ sessionSecret: REDACTED });
  });

  it("writes nothing to the table below the minimum level", async () => {
    logger.debug("test.debug", "Below info");
    await flushLogs();

    expect(await listLogs()).toEqual([]);
  });

  it("stores detail the log service alone would refuse to serialise", async () => {
    const detail: Record<string, unknown> = { rows: BigInt(3) };
    detail.self = detail;

    logger.info("test.event", "Odd values", detail);
    await flushLogs();

    const [entry] = await listLogs();
    expect(entry.detail).toEqual({ rows: "3", self: "[circular]" });
  });
});
