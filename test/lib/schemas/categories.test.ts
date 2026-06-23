import { describe, it, expect } from "vitest";
import { z } from "zod";
import { categoryCreateSchema, categoryUpdateSchema } from "../../../src/lib/schemas/categories";

const validCategory = {
  name: "Work",
  color: "#6366f1",
};

describe("categoryCreateSchema", () => {
  it("accepts a valid category", () => {
    expect(categoryCreateSchema.safeParse(validCategory).success).toBe(true);
  });

  describe("name", () => {
    it("rejects an empty name with a field-level message", () => {
      const result = categoryCreateSchema.safeParse({ ...validCategory, name: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.name).toContain("Name is required");
      }
    });

    it("rejects a name longer than 60 characters", () => {
      const result = categoryCreateSchema.safeParse({ ...validCategory, name: "a".repeat(61) });
      expect(result.success).toBe(false);
    });
  });

  describe("color", () => {
    it.each(["#6366f1", "#FFFFFF", "#000000", "#aAbBcC"])(
      "accepts the valid 6-digit hex %s",
      (color) => {
        expect(categoryCreateSchema.safeParse({ ...validCategory, color }).success).toBe(true);
      }
    );

    it.each([
      "#fff", // 3-digit shorthand is intentionally rejected
      "6366f1", // missing the leading #
      "#12345g", // 'g' is not a hex digit
      "#6366f12", // 7 digits
      "red", // named colours not allowed
      "",
    ])("rejects the invalid colour %j", (color) => {
      const result = categoryCreateSchema.safeParse({ ...validCategory, color });
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.color?.[0]).toMatch(/hex colour/);
      }
    });
  });
});

describe("categoryUpdateSchema (partial)", () => {
  it("accepts an empty object", () => {
    expect(categoryUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a colour-only update", () => {
    expect(categoryUpdateSchema.safeParse({ color: "#123456" }).success).toBe(true);
  });

  it("still validates a provided field (bad colour fails)", () => {
    expect(categoryUpdateSchema.safeParse({ color: "nope" }).success).toBe(false);
  });
});
