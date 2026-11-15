import { describe, it, expect } from "vitest";

import { entryCount, logDate } from "@/src/features/logs/lib/log-format";

describe("entryCount", () => {
  it.each([
    [0, "0 entries"],
    [1, "1 entry"],
    [2, "2 entries"],
    [50, "50 entries"],
  ])("writes %i as %s", (count, text) => {
    expect(entryCount(count)).toBe(text);
  });

  it("groups thousands with a comma", () => {
    expect(entryCount(1204)).toBe("1,204 entries");
    expect(entryCount(1_000_000)).toBe("1,000,000 entries");
  });
});

describe("logDate", () => {
  // Midday UTC, so the date is the same in every time zone a test machine
  // might be set to.
  it("writes the day, the short month and the year", () => {
    expect(logDate("2026-11-14T12:00:00.000Z")).toBe("14 Nov 2026");
  });

  it("writes a single-digit day without a leading zero", () => {
    expect(logDate("2026-03-05T12:00:00.000Z")).toBe("5 Mar 2026");
  });
});
