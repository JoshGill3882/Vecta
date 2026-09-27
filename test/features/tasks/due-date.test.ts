import { afterEach, describe, it, expect } from "vitest";

import { dueMeta, dueMoment } from "@/src/features/tasks/lib/due-date";

// Sunday 27 September 2026, 10:00 local. Every "today" below is measured from here,
// so the tests mean the same thing whatever day they run on.
const NOW = new Date(2026, 8, 27, 10, 0);

/** Describes a due date against the fixed "now".
 *
 * @param dueAt The stored value, or null for none.
 * @param now The moment to measure from; the fixed Sunday unless overridden.
 * @returns The description `dueMeta` gives it.
 */
function meta(dueAt: string | null, now: Date = NOW) {
  return dueMeta({ dueAt }, now);
}

describe("dueMoment", () => {
  it("leaves a due time as it is", () => {
    expect(dueMoment("2026-09-27T09:00")).toBe("2026-09-27T09:00");
  });

  // A date with no time is due once the whole day has gone, not at its start.
  it("puts a date-only due date at the end of its day", () => {
    expect(dueMoment("2026-09-27")).toBe("2026-09-27T23:59:59");
  });

  it("orders a date-only due date after every time on the same day", () => {
    expect(dueMoment("2026-09-27") > dueMoment("2026-09-27T23:59")).toBe(true);
    expect(dueMoment("2026-09-27") < dueMoment("2026-09-28T00:00")).toBe(true);
  });
});

describe("dueMeta", () => {
  it("describes nothing when there is no due date", () => {
    expect(meta(null)).toBeNull();
  });

  describe("labels, by distance from today", () => {
    it.each([
      ["today", "2026-09-27", "Due today", "soon"],
      ["tomorrow", "2026-09-28", "Due tomorrow", "soon"],
      ["two days out, by weekday", "2026-09-29", "Due Tue", "soon"],
      ["six days out, by weekday", "2026-10-03", "Due Sat", "soon"],
      // A weekday seven days out is today's own weekday: "Due Sun" on a Sunday
      // would read as today, so from here on the date is spelled out.
      ["seven days out, by date", "2026-10-04", "Due 4 Oct", "future"],
      ["further out, by date", "2026-10-09", "Due 9 Oct", "future"],
      // en-GB writes September as "Sept"; every other month keeps three letters.
      ["passed, by date", "2026-09-25", "Due 25 Sept", "past"],
    ])("%s", (_, dueAt, label, state) => {
      expect(meta(dueAt)).toMatchObject({ label, state });
    });
  });

  it("appends the time when one is set", () => {
    expect(meta("2026-09-28T17:30")?.label).toBe("Due tomorrow · 17:30");
    expect(meta("2026-10-09T17:30")?.label).toBe("Due 9 Oct · 17:30");
  });

  // A date-only due date is due by the end of the day, so it is still "today" -
  // not passed - at any time during today.
  it("keeps a date-only due date on today until the day ends", () => {
    expect(meta("2026-09-27", new Date(2026, 8, 27, 23, 59))).toMatchObject({
      label: "Due today",
      state: "soon",
    });
  });

  it("rolls over to the day as a whole, not 24 hours from now", () => {
    // Tomorrow at 00:30 is only half an hour away at 23:59, but it is still tomorrow.
    expect(meta("2026-09-28T00:30", new Date(2026, 8, 27, 23, 59))?.label).toBe(
      "Due tomorrow · 00:30"
    );
  });

  it("uses a clock when a time matters and a calendar otherwise", () => {
    expect(meta("2026-10-09T17:30")?.icon).toBe("clock");
    expect(meta("2026-10-09")?.icon).toBe("calendar");
    // Today and tomorrow are about the hours left, so they always take the clock.
    expect(meta("2026-09-28")?.icon).toBe("clock");
  });

  it("spells out the full date, with the time when set", () => {
    expect(meta("2026-10-09T17:30")?.full).toBe("Friday, 9 October 2026 at 17:30");
    expect(meta("2026-10-09")?.full).toBe("Friday, 9 October 2026");
  });
});

describe("dueMeta across timezones", () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });

  // The bug a DateTime column causes: a date read as UTC midnight shows as the day
  // before anywhere west of UTC. Stored as local text, the 15th stays the 15th.
  it("keeps the stored day west of UTC", () => {
    process.env.TZ = "America/New_York";

    expect(meta("2026-10-09")?.full).toBe("Friday, 9 October 2026");
  });

  // UK clocks go back on 25 October 2026, making that day 25 hours long. Counting
  // days by elapsed hours would get this wrong; counting calendar days does not.
  it("counts calendar days across a daylight-saving change", () => {
    process.env.TZ = "Europe/London";

    expect(meta("2026-10-26", new Date(2026, 9, 24, 12, 0))?.label).toBe("Due Mon");
    expect(meta("2026-10-25", new Date(2026, 9, 24, 23, 30))?.label).toBe("Due tomorrow");
  });
});
