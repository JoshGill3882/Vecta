import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validate } from "../../src/lib/validation";

// A small throwaway schema keeps these tests about `validate`'s contract, not
// about any particular task/category rule (those are covered in schemas/*).
const schema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.number().int().min(0, "Age must be non-negative"),
});

describe("validate", () => {
  it("returns success with the parsed, typed data on a valid input", () => {
    const result = validate(schema, { name: "Ada", age: 36 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ name: "Ada", age: 36 });
  });

  it("returns field-keyed errors for invalid input", () => {
    const result = validate(schema, { name: "", age: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.name).toContain("Name is required");
      expect(result.fieldErrors.age).toContain("Age must be non-negative");
    }
  });

  it("omits fields that have no errors", () => {
    const result = validate(schema, { name: "", age: 10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.name).toBeDefined();
      // `age` was valid, so it must not appear as a key at all.
      expect(result.fieldErrors).not.toHaveProperty("age");
    }
  });

  it("surfaces cross-field issues via formErrors, not fieldErrors", () => {
    const refined = z
      .object({ password: z.string(), confirm: z.string() })
      .refine((v) => v.password === v.confirm, "Passwords must match");
    const result = validate(refined, { password: "a", confirm: "b" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.formErrors).toContain("Passwords must match");
      expect(Object.keys(result.fieldErrors)).toHaveLength(0);
    }
  });
});
