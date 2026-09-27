import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  dueAtSchema,
  taskCreateSchema,
  taskUpdateSchema,
  TASK_STATUSES,
} from "@/src/shared/lib/schemas/tasks";

// A known-good payload. Each test clones this and breaks exactly one field, so a
// failure can only be caused by the rule under test (not an unrelated invalid field).
const validTask = {
  title: "Write the validation tests",
  description: "Cover every branch of the schema",
  status: "open" as const,
  categoryId: "cjld2cjxh0000qzrmn831i7rn", // a real cuid shape for z.cuid()
};

describe("taskCreateSchema", () => {
  it("accepts a fully-populated valid task", () => {
    const result = taskCreateSchema.safeParse(validTask);
    expect(result.success).toBe(true);
  });

  it("accepts the minimal payload (description + categoryId omitted)", () => {
    const result = taskCreateSchema.safeParse({ title: "Just a title", status: "open" });
    expect(result.success).toBe(true);
  });

  it("trims the title and strips surrounding whitespace from the output", () => {
    const result = taskCreateSchema.safeParse({ ...validTask, title: "  Spaced out  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Spaced out");
  });

  describe("title", () => {
    it("rejects an empty title with a field-level message", () => {
      const result = taskCreateSchema.safeParse({ ...validTask, title: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.title).toContain("Title is required");
      }
    });

    it("rejects a whitespace-only title (trim happens before the length check)", () => {
      const result = taskCreateSchema.safeParse({ ...validTask, title: "    " });
      expect(result.success).toBe(false);
    });

    it("rejects a title longer than 120 characters", () => {
      const result = taskCreateSchema.safeParse({ ...validTask, title: "a".repeat(121) });
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.title?.[0]).toMatch(/120 characters/);
      }
    });
  });

  describe("status", () => {
    it.each(TASK_STATUSES)("accepts the valid status %s", (status) => {
      const result = taskCreateSchema.safeParse({ ...validTask, status });
      expect(result.success).toBe(true);
    });

    it("rejects a status outside the enum", () => {
      const result = taskCreateSchema.safeParse({ ...validTask, status: "archived" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.status).toBeDefined();
      }
    });

    it("rejects a missing status", () => {
      const { status, ...withoutStatus } = validTask;
      const result = taskCreateSchema.safeParse(withoutStatus);
      expect(result.success).toBe(false);
    });
  });

  describe("categoryId", () => {
    it("rejects a categoryId that is not a cuid", () => {
      const result = taskCreateSchema.safeParse({ ...validTask, categoryId: "not-an-id" });
      expect(result.success).toBe(false);
    });
  });

  it("reports every invalid field at once, keyed by field name", () => {
    const result = taskCreateSchema.safeParse({ title: "", status: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const { fieldErrors } = z.flattenError(result.error);
      expect(fieldErrors.title).toBeDefined();
      expect(fieldErrors.status).toBeDefined();
    }
  });
});

describe("taskUpdateSchema (partial)", () => {
  it("accepts an empty object — nothing is required on update", () => {
    expect(taskUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a single-field update", () => {
    expect(taskUpdateSchema.safeParse({ status: "closed" }).success).toBe(true);
  });

  it("still enforces a provided field's rules (empty title fails)", () => {
    const result = taskUpdateSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });
});

describe("dueAtSchema", () => {
  it.each([
    ["a date", "2026-09-15"],
    ["a date with a time", "2026-09-15T17:30"],
    ["midnight", "2026-09-15T00:00"],
    ["the last minute of the day", "2026-09-15T23:59"],
    ["a leap day in a leap year", "2028-02-29"],
  ])("accepts %s", (_, value) => {
    expect(dueAtSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    // A naive regex lets this through: the shape is right, the day does not exist.
    ["a day the month does not have", "2026-02-30"],
    // A naive `new Date()` lets this through: it parses unpadded parts happily.
    ["unpadded month and day", "2026-9-1"],
    ["an hour past 23", "2026-09-15T25:00"],
    ["a minute past 59", "2026-09-15T17:60"],
    ["a leap day in a common year", "2026-02-29"],
    ["month 13", "2026-13-01"],
    ["seconds", "2026-09-15T17:30:00"],
    ["a timezone offset", "2026-09-15T17:30Z"],
    ["a full ISO timestamp", "2026-09-15T17:30:00.000Z"],
    ["a day-first date", "15/09/2026"],
    ["a time with no date", "17:30"],
    ["an empty string", ""],
    ["surrounding whitespace", " 2026-09-15 "],
  ])("rejects %s", (_, value) => {
    expect(dueAtSchema.safeParse(value).success).toBe(false);
  });
});

describe("dueAt on a task", () => {
  // The three shapes mirror the nullable column: set it, clear it, or leave it.
  it("accepts a due date on create", () => {
    const result = taskCreateSchema.safeParse({ ...validTask, dueAt: "2026-09-15T17:30" });
    expect(result.success).toBe(true);
  });

  it("accepts null, which clears the due date", () => {
    expect(taskUpdateSchema.safeParse({ dueAt: null }).success).toBe(true);
  });

  it("accepts it omitted, which leaves the due date alone", () => {
    const result = taskUpdateSchema.safeParse({ title: "Renamed" });
    expect(result.success).toBe(true);
    if (result.success) expect("dueAt" in result.data).toBe(false);
  });

  it("reports an invalid due date against the dueAt field", () => {
    const result = taskCreateSchema.safeParse({ ...validTask, dueAt: "2026-02-30" });
    expect(result.success).toBe(false);
    if (!result.success) expect(z.flattenError(result.error).fieldErrors.dueAt).toBeDefined();
  });
});
