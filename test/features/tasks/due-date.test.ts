import { afterEach, describe, it, expect } from "vitest";

import type { TaskStatus } from "@/src/shared/lib/dtos/tasks";
import { dueMeta, dueMoment } from "@/src/features/tasks/lib/due-date";

// Sunday 27 September 2026, 10:00 local. Every "today" below is measured from here,
// so the tests mean the same thing whatever day they run on.
const NOW = new Date(2026, 8, 27, 10, 0);

/** Describes an open task's due date against the fixed "now".
 *
 * @param dueAt The stored value, or null for none.
 * @param now The moment to measure from; the fixed Sunday unless overridden.
 * @param status The task's status; open unless the test is about another.
 * @returns The description `dueMeta` gives it.
 */
function meta(dueAt: string | null, now: Date = NOW, status: TaskStatus = "open") {
  return dueMeta({ dueAt, status }, now);
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

  describe("an open task, by distance from today", () => {
    it.each([
      ["due today", "2026-09-27", "Due today", "today"],
      ["due tomorrow", "2026-09-28", "Due tomorrow", "soon"],
      ["two days out, by weekday", "2026-09-29", "Due Tue", "soon"],
      ["six days out, by weekday", "2026-10-03", "Due Sat", "soon"],
      // A weekday seven days out is today's own weekday: "Due Sun" on a Sunday
      // would read as today, so from here on the date is spelled out.
      ["seven days out, by date", "2026-10-04", "Due 4 Oct", "future"],
      ["further out, by date", "2026-10-09", "Due 9 Oct", "future"],
      ["a day late", "2026-09-26", "1 day overdue", "overdue"],
      ["days late", "2026-09-22", "5 days overdue", "overdue"],
    ])("%s", (_, dueAt, label, state) => {
      expect(meta(dueAt)).toMatchObject({ label, state });
    });
  });

  it("appends the time when one is set", () => {
    expect(meta("2026-09-27T17:30")?.label).toBe("Due today · 17:30");
    expect(meta("2026-09-28T17:30")?.label).toBe("Due tomorrow · 17:30");
    expect(meta("2026-10-09T17:30")?.label).toBe("Due 9 Oct · 17:30");
  });

  // Overdue is checked before the "today" wording: a time that has passed today
  // is late now, not something still to do today.
  it("marks a time already passed today as overdue", () => {
    expect(meta("2026-09-27T09:00")).toMatchObject({
      label: "Overdue · 09:00",
      state: "overdue",
      icon: "alert",
    });
  });

  it("turns a due time overdue the moment it passes, not before", () => {
    const dueAt = "2026-09-27T17:30";
    expect(meta(dueAt, new Date(2026, 8, 27, 17, 29))?.state).toBe("today");
    expect(meta(dueAt, new Date(2026, 8, 27, 17, 31))?.state).toBe("overdue");
  });

  // A date-only due date is due by the end of its day: never overdue during it.
  describe("the end-of-day rule", () => {
    it.each([
      ["just after midnight", new Date(2026, 8, 27, 0, 1)],
      ["mid-morning", NOW],
      ["just before midnight", new Date(2026, 8, 27, 23, 58)],
    ])("keeps a date-only task due today %s", (_, now) => {
      expect(meta("2026-09-27", now)).toMatchObject({ label: "Due today", state: "today" });
    });

    it("makes it overdue once the day has rolled over", () => {
      expect(meta("2026-09-27", new Date(2026, 8, 28, 0, 1))).toMatchObject({
        label: "1 day overdue",
        state: "overdue",
      });
    });
  });

  it("counts lateness in calendar days, not 24-hour spans", () => {
    // Due at 23:00 yesterday is only 11 hours late at 10:00, but it is still a day late.
    expect(meta("2026-09-26T23:00")?.label).toBe("1 day overdue");
  });

  it("rolls over to the day as a whole, not 24 hours from now", () => {
    // Tomorrow at 00:30 is only half an hour away at 23:59, but it is still tomorrow.
    expect(meta("2026-09-28T00:30", new Date(2026, 8, 27, 23, 59))?.label).toBe(
      "Due tomorrow · 00:30"
    );
  });

  // A finished task is never chased: its date is history, worded in the past.
  describe("a closed task", () => {
    it.each([
      ["a date that has passed", "2026-09-22"],
      ["a date due today", "2026-09-27"],
      ["a date still to come", "2026-10-09"],
    ])("is never overdue, for %s", (_, dueAt) => {
      expect(meta(dueAt, NOW, "closed")?.state).toBe("done");
    });

    it("reads as was due, with a calendar", () => {
      expect(meta("2026-09-22T17:30", NOW, "closed")).toMatchObject({
        // en-GB writes September as "Sept"; every other month keeps three letters.
        label: "Was due 22 Sept",
        icon: "calendar",
      });
    });
  });

  it("is overdue for an in-progress task, like an open one", () => {
    expect(meta("2026-09-22", NOW, "in_progress")?.state).toBe("overdue");
  });

  it("chooses the icon by state and by whether a time matters", () => {
    expect(meta("2026-09-22")?.icon).toBe("alert");
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

  // "Passed" is measured on the reader's own clock. Either side of UTC, a
  // date-only task due today is due today until that reader's midnight.
  it.each(["America/Los_Angeles", "UTC", "Asia/Tokyo"])(
    "keeps a date-only task due today until local midnight in %s",
    (zone) => {
      process.env.TZ = zone;

      expect(meta("2026-09-27", new Date(2026, 8, 27, 23, 58))?.state).toBe("today");
      expect(meta("2026-09-27", new Date(2026, 8, 28, 0, 1))?.state).toBe("overdue");
    }
  );

  // UK clocks go back on 25 October 2026, making that day 25 hours long. Counting
  // days by elapsed hours would get this wrong; counting calendar days does not.
  it("counts calendar days across a daylight-saving change", () => {
    process.env.TZ = "Europe/London";

    expect(meta("2026-10-26", new Date(2026, 9, 24, 12, 0))?.label).toBe("Due Mon");
    expect(meta("2026-10-25", new Date(2026, 9, 24, 23, 30))?.label).toBe("Due tomorrow");
  });
});
