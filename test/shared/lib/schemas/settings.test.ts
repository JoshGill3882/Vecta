import { describe, it, expect } from "vitest";
import {
  DEFAULT_LOG_RETENTION_DAYS,
  LOG_RETENTION_DAYS,
  logRetentionDaysSchema,
} from "@/src/shared/lib/schemas/settings";

describe("LOG_RETENTION_DAYS", () => {
  it("offers 7 days, 30 days, 90 days, 1 year and forever, in that order", () => {
    expect(LOG_RETENTION_DAYS).toEqual([7, 30, 90, 365, 0]);
  });

  it("includes the default", () => {
    expect(DEFAULT_LOG_RETENTION_DAYS).toBe(90);
    expect(LOG_RETENTION_DAYS).toContain(DEFAULT_LOG_RETENTION_DAYS);
  });
});

describe("logRetentionDaysSchema", () => {
  it.each([...LOG_RETENTION_DAYS])("accepts %i", (days) => {
    expect(logRetentionDaysSchema.parse(days)).toBe(days);
  });

  it.each([
    ["a length that is not a choice", 14],
    ["a negative length", -7],
    ["a fraction of a choice", 7.5],
    ["a choice written as text", "90"],
    ["empty text, which a careless conversion would read as forever", ""],
    ["nothing", undefined],
    ["null", null],
    ["not a number", Number.NaN],
  ])("refuses %s", (_label, value) => {
    expect(logRetentionDaysSchema.safeParse(value).success).toBe(false);
  });
});
