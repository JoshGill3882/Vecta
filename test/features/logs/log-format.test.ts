import { afterEach, describe, it, expect } from "vitest";

import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { entryCount, groupByDay, logDate, logTime } from "@/src/features/logs/lib/log-format";

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

describe("logTime", () => {
  // Built from local time, so the clock reads the same in any time zone.
  it("writes hours, minutes and seconds on a 24-hour clock", () => {
    expect(logTime(new Date(2026, 10, 14, 9, 5, 7).toISOString())).toBe("09:05:07");
    expect(logTime(new Date(2026, 10, 14, 21, 30, 0).toISOString())).toBe("21:30:00");
  });
});

/** An entry written at a local time, for grouping.
 *
 * @param id The entry's id.
 * @param at When it was written, in local time.
 * @returns The entry.
 */
function entryAt(id: string, at: Date): LogEntryDTO {
  return {
    id,
    createdAt: at.toISOString(),
    kind: "activity",
    level: "info",
    event: "task.created",
    source: "tasks",
    message: "Created a task",
    detail: null,
  };
}

describe("groupByDay", () => {
  const now = new Date(2026, 10, 14, 15, 0);

  it("puts each day's entries under one heading, in the order given", () => {
    const entries = [
      entryAt("a", new Date(2026, 10, 14, 14, 0)),
      entryAt("b", new Date(2026, 10, 14, 0, 0)),
      entryAt("c", new Date(2026, 10, 13, 23, 59)),
      entryAt("d", new Date(2026, 10, 10, 9, 0)),
      entryAt("e", new Date(2026, 10, 10, 8, 0)),
    ];

    expect(
      groupByDay(entries, now).map((day) => [day.key, day.label, day.entries.map((e) => e.id)])
    ).toEqual([
      ["2026-11-14", "Today", ["a", "b"]],
      ["2026-11-13", "Yesterday", ["c"]],
      ["2026-11-10", "Tue 10 Nov", ["d", "e"]],
    ]);
  });

  it("names the year only when it is not this one", () => {
    const [day] = groupByDay([entryAt("a", new Date(2025, 10, 14, 12, 0))], now);

    expect(day.label).toBe("Fri, 14 Nov 2025");
  });

  it("finds yesterday across a new year", () => {
    const [day] = groupByDay(
      [entryAt("a", new Date(2025, 11, 31, 12, 0))],
      new Date(2026, 0, 1, 9, 0)
    );

    expect(day.label).toBe("Yesterday");
  });

  it("gives back no days for no entries", () => {
    expect(groupByDay([], now)).toEqual([]);
  });

  it("does not move the caller's entries", () => {
    const entries = [entryAt("a", new Date(2026, 10, 14, 9, 0))];

    expect(groupByDay(entries, now)[0].entries[0]).toBe(entries[0]);
  });
});

describe("groupByDay across time zones", () => {
  const original = process.env.TZ;
  afterEach(() => {
    // Assigning undefined would store the string "undefined", which Node reads
    // as UTC, leaving every later test in the file in the wrong zone.
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  // The clocks went forward in London on 29 March 2026, so that day had 23
  // hours. Half an hour into the 30th, 24 hours back lands on the 28th, so
  // yesterday must be counted in calendar days to land on the 29th.
  it("still finds yesterday the day after the clocks change", () => {
    process.env.TZ = "Europe/London";

    const [day] = groupByDay(
      [entryAt("a", new Date(2026, 2, 28, 23, 45))],
      new Date(2026, 2, 30, 0, 30)
    );
    expect(day.label).not.toBe("Yesterday");

    const [sameDay] = groupByDay(
      [entryAt("b", new Date(2026, 2, 29, 0, 15))],
      new Date(2026, 2, 30, 0, 30)
    );
    expect(sameDay.label).toBe("Yesterday");
  });

  // A day is the reader's local day: an entry just after midnight in Tokyo is
  // the day after the same moment in London.
  it("divides days at local midnight", () => {
    const at = "2026-11-13T15:30:00.000Z";

    process.env.TZ = "Asia/Tokyo";
    expect(groupByDay([entryAt("a", new Date(at))], new Date(at))[0].key).toBe("2026-11-14");

    process.env.TZ = "Europe/London";
    expect(groupByDay([entryAt("a", new Date(at))], new Date(at))[0].key).toBe("2026-11-13");
  });
});
