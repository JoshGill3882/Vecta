import { describe, it, expect } from "vitest";
import { entryMessage } from "@/src/features/logs/lib/entry-message";

/** Builds an entry the way the services record one.
 *
 * @param event The entry's event name.
 * @param detail The detail recorded with it, or null for none.
 * @param message The stored message, which the wording replaces or falls back to.
 * @returns The fields the message is built from.
 */
function entry(event: string, detail: Record<string, unknown> | null, message = "Stored message") {
  return { event, detail, message };
}

describe("entryMessage", () => {
  it.each([
    ["task.created", { taskId: "t1", title: "Buy milk" }, "Created “Buy milk”"],
    ["task.updated", { taskId: "t1", title: "Buy milk", changed: ["title"] }, "Updated “Buy milk”"],
    ["task.deleted", { taskId: "t1", title: "Buy milk" }, "Deleted “Buy milk”"],
    ["category.created", { categoryId: "c1", name: "Work" }, "Created category “Work”"],
    [
      "category.updated",
      { categoryId: "c1", name: "Home", changed: ["name", "color"] },
      "Renamed category to “Home”",
    ],
    [
      "category.updated",
      { categoryId: "c1", name: "Home", changed: ["color"] },
      "Updated category “Home”",
    ],
    [
      "category.deleted",
      { categoryId: "c1", name: "Work", uncategorisedTasks: 2 },
      "Deleted category “Work”",
    ],
  ])("words %s by what it was about", (event, detail, expected) => {
    expect(entryMessage(entry(event, detail))).toBe(expected);
  });

  it("calls an update that changed nothing an update, not a rename", () => {
    const detail = { categoryId: "c1", name: "Home", changed: [] };
    expect(entryMessage(entry("category.updated", detail))).toBe("Updated category “Home”");
  });

  it("keeps a title's own quotes and symbols as they were typed", () => {
    const detail = { taskId: "t1", title: "Fix “the” <b>bug</b> & ship" };
    expect(entryMessage(entry("task.deleted", detail))).toBe(
      "Deleted “Fix “the” <b>bug</b> & ship”"
    );
  });

  it.each([
    ["wrong_password", "Sign-in failed: wrong password"],
    ["rate_limited", "Sign-in refused: too many attempts"],
  ])("says why a sign-in failed, for %s", (reason, expected) => {
    expect(entryMessage(entry("auth.sign_in_failed", { reason }))).toBe(expected);
  });

  it.each([
    ["auth.signed_in", "Signed in"],
    ["auth.signed_out", "Signed out"],
    ["server.started", "Vecta started"],
    ["action.unexpected_error", "A server action failed unexpectedly"],
    ["log.purged", "Purged log entries"],
  ])("shows the stored message for %s", (event, message) => {
    expect(entryMessage(entry(event, null, message))).toBe(message);
  });

  it.each([
    ["no detail", null],
    ["no title", { taskId: "t1" }],
    ["an empty title", { taskId: "t1", title: "" }],
    ["a title that is not text", { taskId: "t1", title: 42 }],
    ["damaged detail", { unparsed: "{oops" }],
  ])("falls back to the stored message for a task entry with %s", (_, detail) => {
    expect(entryMessage(entry("task.deleted", detail, "Task deleted"))).toBe("Task deleted");
  });

  it("falls back to the stored message for a category entry with no name", () => {
    expect(entryMessage(entry("category.deleted", { categoryId: "c1" }, "Category deleted"))).toBe(
      "Category deleted"
    );
  });

  it.each([
    ["an unknown reason", { reason: "locked_out" }],
    ["no reason", {}],
    ["a reason an object inherits", { reason: "constructor" }],
  ])("falls back to the stored message for a failed sign-in with %s", (_, detail) => {
    expect(entryMessage(entry("auth.sign_in_failed", detail, "Sign-in failed"))).toBe(
      "Sign-in failed"
    );
  });

  it("calls a rename a rename only when changed is a list", () => {
    const detail = { categoryId: "c1", name: "Home", changed: "name" };
    expect(entryMessage(entry("category.updated", detail))).toBe("Updated category “Home”");
  });
});
