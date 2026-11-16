import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real logger runs, so a failed run's entry can be read from stdout; the
// services behind a run are stood in for, so the timer is all that is tested.
vi.mock("@/src/server/services/logs", () => ({
  writeLog: vi.fn(async () => ({})),
  deleteLogsBefore: vi.fn(async () => 0),
}));
vi.mock("@/src/server/services/settings", () => ({
  getSettings: vi.fn(async () => ({ logRetentionDays: 90, lastAgeOut: null })),
  recordAgeOut: vi.fn(async () => {}),
}));

import { nextAgeOutAt, startAgeOutSchedule, stopAgeOutSchedule } from "@/src/server/log-retention";
import { flushLogs } from "@/src/server/logger";
import { deleteLogsBefore } from "@/src/server/services/logs";
import { getSettings, recordAgeOut } from "@/src/server/services/settings";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const originalTZ = process.env.TZ;
let lines: string[];

/** Every JSON line written to stdout since the test began.
 *
 * @returns The lines, parsed.
 */
function stdout(): Record<string, unknown>[] {
  return lines.map((line) => JSON.parse(line));
}

/** Counts the runs that have reached the delete so far.
 *
 * @returns How many there have been.
 */
function runs(): number {
  return vi.mocked(deleteLogsBefore).mock.calls.length;
}

beforeEach(() => {
  process.env.TZ = "UTC";
  lines = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  vi.mocked(deleteLogsBefore).mockClear();
  vi.mocked(getSettings).mockClear();
  vi.mocked(recordAgeOut).mockClear();
});

afterEach(async () => {
  stopAgeOutSchedule();
  vi.useRealTimers();
  await flushLogs();
  vi.restoreAllMocks();
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe("nextAgeOutAt", () => {
  it.each([
    ["before 03:00", "2026-11-16T02:59:59.999Z", "2026-11-16T03:00:00.000Z"],
    ["at 03:00, which counts as past", "2026-11-16T03:00:00.000Z", "2026-11-17T03:00:00.000Z"],
    ["just after 03:00", "2026-11-16T03:00:00.001Z", "2026-11-17T03:00:00.000Z"],
    ["late in the evening", "2026-11-16T23:30:00.000Z", "2026-11-17T03:00:00.000Z"],
    ["on the last day of a month", "2026-11-30T12:00:00.000Z", "2026-12-01T03:00:00.000Z"],
    ["on the last day of a year", "2026-12-31T12:00:00.000Z", "2027-01-01T03:00:00.000Z"],
  ])("from %s, is the next 03:00", (_, after, next) => {
    expect(nextAgeOutAt(new Date(after)).toISOString()).toBe(next);
  });

  it("follows the server's clock, not UTC", () => {
    process.env.TZ = "Asia/Tokyo";
    // 03:00 in Tokyo, nine hours ahead, is 18:00 UTC the evening before.
    expect(nextAgeOutAt(new Date("2026-11-16T12:00:00.000Z")).toISOString()).toBe(
      "2026-11-16T18:00:00.000Z"
    );
  });

  it.each([
    ["back, on 25 October 2026", "2026-10-24T12:00:00.000Z", "2026-10-25T03:00:00.000Z"],
    ["forward, on 28 March 2027", "2027-03-27T12:00:00.000Z", "2027-03-28T02:00:00.000Z"],
  ])("stays at 03:00 when London's clocks go %s", (_, after, next) => {
    process.env.TZ = "Europe/London";
    const at = nextAgeOutAt(new Date(after));

    expect(at.toISOString()).toBe(next);
    expect(at.getHours()).toBe(3);
  });
});

describe("startAgeOutSchedule", () => {
  /** Starts fake time at a moment, so the timer can be stepped through.
   *
   * @param iso The moment to start at.
   */
  function startAt(iso: string): void {
    vi.useFakeTimers({ now: new Date(iso) });
  }

  it("runs once straight away, to catch up on any night the server was down", async () => {
    startAt("2026-11-16T10:00:00.000Z");
    startAgeOutSchedule();
    await vi.advanceTimersByTimeAsync(0);

    expect(runs()).toBe(1);
    expect(recordAgeOut).toHaveBeenCalledWith(new Date("2026-11-16T10:00:00.000Z"), 0);
  });

  it("runs next at 03:00, not before", async () => {
    startAt("2026-11-16T10:00:00.000Z");
    startAgeOutSchedule();

    await vi.advanceTimersByTimeAsync(17 * HOUR - 1);
    expect(runs()).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(runs()).toBe(2);
    expect(recordAgeOut).toHaveBeenLastCalledWith(new Date("2026-11-17T03:00:00.000Z"), 0);
  });

  it("runs every night after that", async () => {
    startAt("2026-11-16T10:00:00.000Z");
    startAgeOutSchedule();

    await vi.advanceTimersByTimeAsync(17 * HOUR + 3 * DAY);

    expect(runs()).toBe(5);
  });

  it("runs at 03:00 the same night when started before it", async () => {
    startAt("2026-11-16T01:00:00.000Z");
    startAgeOutSchedule();

    await vi.advanceTimersByTimeAsync(2 * HOUR);

    expect(runs()).toBe(2);
  });

  it("writes nothing to the log when a run works", async () => {
    startAt("2026-11-16T10:00:00.000Z");
    startAgeOutSchedule();
    await vi.advanceTimersByTimeAsync(17 * HOUR);

    expect(stdout()).toEqual([]);
  });

  it("deletes nothing, but still records the run, when entries are kept forever", async () => {
    vi.mocked(getSettings).mockResolvedValueOnce({ logRetentionDays: 0, lastAgeOut: null });
    startAt("2026-11-16T10:00:00.000Z");
    startAgeOutSchedule();
    await vi.advanceTimersByTimeAsync(0);

    expect(deleteLogsBefore).not.toHaveBeenCalled();
    expect(recordAgeOut).toHaveBeenCalledWith(new Date("2026-11-16T10:00:00.000Z"), 0);
  });

  it("logs a failed run as an operational error and tries again the next night", async () => {
    vi.mocked(getSettings).mockRejectedValueOnce(new Error("database is locked"));
    startAt("2026-11-16T10:00:00.000Z");

    expect(() => startAgeOutSchedule()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);

    expect(runs()).toBe(0);
    expect(stdout()).toEqual([
      expect.objectContaining({
        kind: "operational",
        level: "error",
        event: "log.age_out_failed",
        detail: expect.objectContaining({
          error: expect.objectContaining({ message: "database is locked" }),
        }),
      }),
    ]);

    await vi.advanceTimersByTimeAsync(17 * HOUR);
    expect(runs()).toBe(1);
  });

  it("keeps running nightly after a nightly run fails", async () => {
    startAt("2026-11-16T10:00:00.000Z");
    startAgeOutSchedule();
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(deleteLogsBefore).mockRejectedValueOnce(new Error("disk I/O error"));

    await vi.advanceTimersByTimeAsync(17 * HOUR + DAY);

    expect(stdout().map((line) => line.event)).toEqual(["log.age_out_failed"]);
    expect(runs()).toBe(3);
  });

  it("sets one timer however often it is started", async () => {
    startAt("2026-11-16T10:00:00.000Z");
    startAgeOutSchedule();
    startAgeOutSchedule();

    await vi.advanceTimersByTimeAsync(17 * HOUR);

    expect(runs()).toBe(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("stops running once stopped", async () => {
    startAt("2026-11-16T10:00:00.000Z");
    startAgeOutSchedule();
    await vi.advanceTimersByTimeAsync(0);

    stopAgeOutSchedule();
    await vi.advanceTimersByTimeAsync(3 * DAY);

    expect(runs()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sets no new timer when stopped while a nightly run is going", async () => {
    startAt("2026-11-16T10:00:00.000Z");
    startAgeOutSchedule();
    await vi.advanceTimersByTimeAsync(0);
    let finish: () => void = () => {};
    vi.mocked(deleteLogsBefore).mockImplementationOnce(
      () => new Promise<number>((resolve) => (finish = () => resolve(0)))
    );

    await vi.advanceTimersByTimeAsync(17 * HOUR);
    stopAgeOutSchedule();
    finish();
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not hold the process open by itself", () => {
    const unref = vi.fn();
    vi.spyOn(globalThis, "setTimeout").mockReturnValue({ unref } as unknown as NodeJS.Timeout);

    startAgeOutSchedule();

    expect(unref).toHaveBeenCalledOnce();
  });
});
