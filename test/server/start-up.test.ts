import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real logger runs; only its table write is stood in for, so these tests
// read exactly what reaches stdout.
vi.mock("@/src/server/services/logs", () => ({ writeLog: vi.fn(async () => ({})) }));

import { flushLogs } from "@/src/server/logger";
import { writeLog } from "@/src/server/services/logs";
import { configurationProblem, startUp } from "@/src/server/start-up";

const VALID = {
  ADMIN_PASSWORD: "hunter2",
  SESSION_SECRET: "x".repeat(32),
  DATABASE_URL: "file:./data/app.db",
};
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

describe("configurationProblem", () => {
  it("finds nothing wrong with a valid configuration", () => {
    expect(configurationProblem(VALID)).toBeNull();
  });

  it.each([
    [
      "no ADMIN_PASSWORD",
      { ADMIN_PASSWORD: undefined },
      "ADMIN_PASSWORD environment variable is required.",
    ],
    [
      "no SESSION_SECRET",
      { SESSION_SECRET: undefined },
      "SESSION_SECRET environment variable is required.",
    ],
    [
      "a SESSION_SECRET of 31 characters",
      { SESSION_SECRET: "x".repeat(31) },
      "SESSION_SECRET must be at least 32 characters long.",
    ],
    [
      "an unknown LOG_LEVEL",
      { LOG_LEVEL: "verbose" },
      "LOG_LEVEL must be one of debug, info, warn, error, or unset for info.",
    ],
    [
      "a LOG_LEVEL in capitals",
      { LOG_LEVEL: "INFO" },
      "LOG_LEVEL must be one of debug, info, warn, error, or unset for info.",
    ],
  ])("reports %s", (_, change, problem) => {
    expect(configurationProblem({ ...VALID, ...change })).toBe(problem);
  });

  it("accepts a SESSION_SECRET of exactly 32 characters", () => {
    expect(configurationProblem({ ...VALID, SESSION_SECRET: "x".repeat(32) })).toBeNull();
  });

  it.each(["debug", "info", "warn", "error"])("accepts a LOG_LEVEL of %s", (level) => {
    expect(configurationProblem({ ...VALID, LOG_LEVEL: level })).toBeNull();
  });

  it.each([
    ["unset", undefined],
    ["empty, as Compose passes an unset variable", ""],
  ])("accepts LOG_LEVEL %s", (_, value) => {
    expect(configurationProblem({ ...VALID, LOG_LEVEL: value })).toBeNull();
  });

  it("reports the first problem when there are several, in a fixed order", () => {
    expect(configurationProblem({ LOG_LEVEL: "verbose" })).toBe(
      "ADMIN_PASSWORD environment variable is required."
    );
  });
});

describe("startUp", () => {
  it("logs one info entry with the version, revision and database provider", async () => {
    await startUp({ ...VALID, VECTA_BUILD_VERSION: "v1.3.0", VECTA_BUILD_REVISION: "abc123" });

    expect(stdout()).toHaveLength(1);
    expect(stdout()[0]).toMatchObject({
      level: "info",
      event: "server.started",
      detail: { version: "v1.3.0", revision: "abc123", provider: "sqlite" },
    });
  });

  it("writes the start-up entry to the Log table too", async () => {
    await startUp(VALID);
    await flushLogs();

    expect(writeLog).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "operational", event: "server.started" })
    );
  });

  it.each([
    ["no build variables, as outside Docker", {}],
    ["empty build variables", { VECTA_BUILD_VERSION: "", VECTA_BUILD_REVISION: "" }],
  ])("reports a dev build when there are %s", async (_, build) => {
    await startUp({ ...VALID, ...build });

    expect(stdout()[0].detail).toMatchObject({ version: "dev", revision: "unknown" });
  });

  it.each([
    ["postgresql://vecta:s3cret@db:5432/vecta", "postgresql"],
    ["postgres://vecta:s3cret@db:5432/vecta", "postgresql"],
    ["file:./data/app.db", "sqlite"],
    ["mysql://vecta:s3cret@db/vecta", "unknown"],
    [undefined, "unknown"],
  ])("names the provider for DATABASE_URL %j as %s", async (url, provider) => {
    await startUp({ ...VALID, DATABASE_URL: url });

    expect(stdout()[0].detail).toMatchObject({ provider });
    expect(lines.join("")).not.toContain("s3cret");
  });

  it("logs nothing beyond the start-up entry when the configuration is valid", async () => {
    await startUp(VALID);
    await flushLogs();

    expect(stdout().map((l) => l.event)).toEqual(["server.started"]);
  });

  it.each([
    ["no ADMIN_PASSWORD", { ADMIN_PASSWORD: undefined }],
    ["a short SESSION_SECRET", { SESSION_SECRET: "short" }],
    ["an unknown LOG_LEVEL", { LOG_LEVEL: "verbose" }],
  ])("with %s, logs the problem and then refuses to start", async (_, change) => {
    const env = { ...VALID, ...change };
    const problem = configurationProblem(env);

    await expect(startUp(env)).rejects.toThrow(problem!);

    expect(stdout()).toHaveLength(1);
    expect(stdout()[0]).toMatchObject({
      level: "error",
      event: "server.config_invalid",
      detail: { problem },
    });
  });

  it("finishes the table write for a configuration problem before refusing to start", async () => {
    let written = false;
    vi.mocked(writeLog).mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      written = true;
      return {} as never;
    });

    await expect(startUp({ ...VALID, ADMIN_PASSWORD: undefined })).rejects.toThrow();

    expect(written).toBe(true);
  });

  it("never logs the admin password or the session secret", async () => {
    await startUp({ ...VALID, SESSION_SECRET: "s".repeat(40) });
    await expect(startUp({ ...VALID, SESSION_SECRET: "t".repeat(10) })).rejects.toThrow();

    expect(lines.join("")).not.toContain("hunter2");
    expect(lines.join("")).not.toContain("s".repeat(40));
    expect(lines.join("")).not.toContain("t".repeat(10));
  });
});
