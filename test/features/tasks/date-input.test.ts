import { afterEach, describe, it, expect } from "vitest";

import { parseDateInput } from "@/src/features/tasks/lib/date-input";

// Sunday 27 September 2026, 10:00 local. Every relative date below is measured from
// here, so the tests mean the same thing whatever day they run on.
const TODAY = new Date(2026, 8, 27, 10, 0);

/** Parses typed text against the fixed "today".
 *
 * @param raw What the reader typed.
 * @returns What `parseDateInput` makes of it.
 */
function parse(raw: string) {
  return parseDateInput(raw, TODAY);
}

/** The result for text that names a date.
 *
 * @param dayKey The date as `YYYY-MM-DD`.
 * @returns The valid result carrying it.
 */
function valid(dayKey: string) {
  return { status: "valid", dayKey };
}

const INVALID = { status: "invalid" };

describe("parseDateInput", () => {
  // Nothing typed is a cleared field, not a mistake: it removes the due date
  // rather than raising the inline hint.
  describe("empty input", () => {
    it.each([
      ["nothing", ""],
      ["spaces", "   "],
      ["a tab and spaces", " \t "],
    ])("treats %s as empty", (_, raw) => {
      expect(parse(raw)).toEqual({ status: "empty" });
    });
  });

  describe("relative words", () => {
    it.each([
      ["today", "2026-09-27"],
      ["tod", "2026-09-27"],
      ["tomorrow", "2026-09-28"],
      ["tom", "2026-09-28"],
      ["tmr", "2026-09-28"],
      ["yesterday", "2026-09-26"],
    ])("reads %s", (raw, dayKey) => {
      expect(parse(raw)).toEqual(valid(dayKey));
    });

    it("ignores case and surrounding space", () => {
      expect(parse("  Tomorrow ")).toEqual(valid("2026-09-28"));
      expect(parse("TODAY")).toEqual(valid("2026-09-27"));
    });
  });

  describe("day offsets", () => {
    it.each([
      ["+3", "2026-09-30"],
      ["+0", "2026-09-27"],
      ["-3", "2026-09-24"],
      ["+3d", "2026-09-30"],
      ["+ 3", "2026-09-30"],
      // Across the end of the month and the year.
      ["+7", "2026-10-04"],
      ["+100", "2027-01-05"],
    ])("reads %s", (raw, dayKey) => {
      expect(parse(raw)).toEqual(valid(dayKey));
    });

    it("caps an offset at three digits", () => {
      expect(parse("+1000")).toEqual(INVALID);
    });
  });

  describe("ISO dates", () => {
    it.each([
      ["2026-09-24", "2026-09-24"],
      ["2026-9-4", "2026-09-04"],
      ["2026/09/24", "2026-09-24"],
      ["2026.09.24", "2026-09-24"],
    ])("reads %s", (raw, dayKey) => {
      expect(parse(raw)).toEqual(valid(dayKey));
    });
  });

  // Numeric dates are read day first, as dates are written everywhere else in
  // the app. 4/9 is the 4th of September, never 9 April.
  describe("numeric dates, day first", () => {
    it.each([
      ["24/9/26", "2026-09-24"],
      ["24.9.2026", "2026-09-24"],
      ["24-09-2026", "2026-09-24"],
      ["4/9/26", "2026-09-04"],
      ["4/9", "2026-09-04"],
      ["1/1/27", "2027-01-01"],
    ])("reads %s", (raw, dayKey) => {
      expect(parse(raw)).toEqual(valid(dayKey));
    });

    it("reads a two-digit year as this century", () => {
      expect(parse("24/9/99")).toEqual(valid("2099-09-24"));
    });

    // A three-digit year is a typo for a two- or four-digit one, never year 123.
    it("rejects a three-digit year", () => {
      expect(parse("24/9/202")).toEqual(INVALID);
      expect(parse("24 sep 202")).toEqual(INVALID);
    });

    it("takes the current year when none is given, even for a date already passed", () => {
      expect(parse("24/9")).toEqual(valid("2026-09-24"));
      expect(parse("1/3")).toEqual(valid("2026-03-01"));
    });
  });

  describe("month names", () => {
    it.each([
      ["24 sep", "2026-09-24"],
      ["sep 24", "2026-09-24"],
      ["24 september", "2026-09-24"],
      ["24 september 2027", "2027-09-24"],
      ["sep 24, 2027", "2027-09-24"],
      ["sep 24 27", "2027-09-24"],
      ["24 sep.", "2026-09-24"],
      ["24 Sep", "2026-09-24"],
      ["1 jan", "2026-01-01"],
    ])("reads %s", (raw, dayKey) => {
      expect(parse(raw)).toEqual(valid(dayKey));
    });
  });

  describe("a bare day of the month", () => {
    it("takes the current month and year", () => {
      expect(parse("24")).toEqual(valid("2026-09-24"));
      expect(parse("5")).toEqual(valid("2026-09-05"));
    });

    it("rejects a day the current month does not have", () => {
      expect(parse("31")).toEqual(INVALID);
    });
  });

  // An impossible date is rejected rather than rolled into the next month, so
  // 31/02 raises the hint instead of quietly becoming 3 March.
  describe("impossible dates", () => {
    it.each([
      ["31/02", "31/02"],
      ["30 feb", "30 feb"],
      ["2026-02-30", "2026-02-30"],
      ["31 sep", "31 sep"],
      ["day 0", "0/9/26"],
      ["month 0", "24/0/26"],
      ["month 13", "24/13/26"],
      ["day 32", "32 sep"],
    ])("rejects %s", (_, raw) => {
      expect(parse(raw)).toEqual(INVALID);
    });

    it("knows which years are leap years", () => {
      expect(parse("29/2/28")).toEqual(valid("2028-02-29"));
      expect(parse("29/2/26")).toEqual(INVALID);
    });
  });

  describe("text that names no date", () => {
    it.each([
      ["a word", "soon"],
      ["an unknown month", "24 smarch"],
      ["a phrase", "next friday"],
      ["too many parts", "24/9/26/1"],
      ["a lone separator", "/"],
      ["a three-digit day", "124"],
      // Every object has these properties, so a lookup on a plain object finds them.
      ["a name every object inherits", "constructor"],
      ["another inherited name", "toString"],
    ])("rejects %s", (_, raw) => {
      expect(parse(raw)).toEqual(INVALID);
    });
  });
});

describe("parseDateInput across timezones", () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });

  // "Today" is the reader's own calendar day. Building the key from UTC would hand
  // a reader west of UTC tomorrow's date in the evening.
  it("reads today as the local date late in the evening west of UTC", () => {
    process.env.TZ = "America/Los_Angeles";

    expect(parseDateInput("today", new Date(2026, 8, 27, 23, 30))).toEqual(valid("2026-09-27"));
  });

  // UK clocks go back on 25 October 2026, making that day 25 hours long. Adding
  // offsets in milliseconds would land on the wrong day; adding calendar days does not.
  it("adds calendar days across a daylight-saving change", () => {
    process.env.TZ = "Europe/London";
    const saturday = new Date(2026, 9, 24, 0, 30);

    expect(parseDateInput("tomorrow", saturday)).toEqual(valid("2026-10-25"));
    expect(parseDateInput("+2", saturday)).toEqual(valid("2026-10-26"));
  });
});
