import { describe, it, expect } from "vitest";
import { z } from "zod";
import { LOG_KINDS, LOG_LEVELS, logWriteSchema } from "@/src/shared/lib/schemas/logs";

const validEntry = {
  kind: "activity",
  level: "info",
  event: "task.deleted",
  message: "Deleted the task “Renew the certificate”",
};

describe("logWriteSchema", () => {
  it("accepts a valid entry without detail", () => {
    expect(logWriteSchema.safeParse(validEntry).success).toBe(true);
  });

  it("accepts a valid entry with an object as detail", () => {
    const entry = { ...validEntry, detail: { id: "t1", title: "Renew", tags: ["a"], n: 2 } };
    expect(logWriteSchema.parse(entry).detail).toEqual(entry.detail);
  });

  describe("kind", () => {
    it.each([...LOG_KINDS])("accepts %s", (kind) => {
      expect(logWriteSchema.safeParse({ ...validEntry, kind }).success).toBe(true);
    });

    it.each(["Activity", "audit", "", undefined])("rejects %s", (kind) => {
      expect(logWriteSchema.safeParse({ ...validEntry, kind }).success).toBe(false);
    });
  });

  describe("level", () => {
    it("lists the levels from least to most severe", () => {
      expect(LOG_LEVELS).toEqual(["debug", "info", "warn", "error"]);
    });

    it.each([...LOG_LEVELS])("accepts %s", (level) => {
      expect(logWriteSchema.safeParse({ ...validEntry, level }).success).toBe(true);
    });

    it.each(["warning", "fatal", "INFO", undefined])("rejects %s", (level) => {
      expect(logWriteSchema.safeParse({ ...validEntry, level }).success).toBe(false);
    });
  });

  describe("event", () => {
    it.each(["task.deleted", "action.unexpected_error", "auth.sign_in.failed", "server.v2"])(
      "accepts %s",
      (event) => {
        expect(logWriteSchema.safeParse({ ...validEntry, event }).success).toBe(true);
      }
    );

    it.each([
      "deleted", // a single word says what happened but not to what
      "Task.deleted",
      "task deleted",
      "task.",
      ".deleted",
      "task..deleted",
      "task.2deleted",
      "",
    ])("rejects %j with a field-level message", (event) => {
      const result = logWriteSchema.safeParse({ ...validEntry, event });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(z.flattenError(result.error).fieldErrors.event).toContain(
          "Use lowercase words joined by dots, such as task.deleted"
        );
      }
    });
  });

  describe("message", () => {
    it("rejects an empty message with a field-level message", () => {
      const result = logWriteSchema.safeParse({ ...validEntry, message: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(z.flattenError(result.error).fieldErrors.message).toContain(
          "A log entry needs a message"
        );
      }
    });
  });

  describe("detail", () => {
    it.each([
      ["a string", "id t1"],
      ["a number", 42],
      ["an array", ["t1"]],
      ["null", null],
    ])("rejects %s", (_, detail) => {
      expect(logWriteSchema.safeParse({ ...validEntry, detail }).success).toBe(false);
    });
  });
});
