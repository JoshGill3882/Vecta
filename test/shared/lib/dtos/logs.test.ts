import { describe, it, expect } from "vitest";
import type { LogModel } from "@/generated/prisma-sqlite/models";
import { SOURCE_PREFIXES, sourceOf, toLogEntryDTO } from "@/src/shared/lib/dtos/logs";

const ROW: LogModel = {
  id: "l1",
  createdAt: new Date("2026-11-14T09:30:00.000Z"),
  kind: "activity",
  level: "info",
  event: "task.deleted",
  message: "Deleted a task",
  detail: null,
};

describe("toLogEntryDTO", () => {
  it("maps every field, with the timestamp as an ISO string", () => {
    expect(toLogEntryDTO(ROW)).toEqual({
      id: "l1",
      createdAt: "2026-11-14T09:30:00.000Z",
      kind: "activity",
      level: "info",
      event: "task.deleted",
      source: "tasks",
      message: "Deleted a task",
      detail: null,
    });
  });

  it("reads the source from the event name", () => {
    expect(toLogEntryDTO({ ...ROW, event: "auth.signed_in" }).source).toBe("auth");
    expect(toLogEntryDTO({ ...ROW, event: "server.started" }).source).toBe("system");
  });

  it("parses a stored JSON object back into an object", () => {
    const detail = { id: "t1", title: "Renew", changed: ["title", "status"], nested: { n: 1 } };
    expect(toLogEntryDTO({ ...ROW, detail: JSON.stringify(detail) }).detail).toEqual(detail);
  });

  it("keeps an empty object as an empty object, not as no detail", () => {
    expect(toLogEntryDTO({ ...ROW, detail: "{}" }).detail).toEqual({});
  });

  it.each([
    ["text that is not JSON", "not json"],
    ["truncated JSON", '{"id": "t1"'],
    ["a JSON array", '["t1"]'],
    ["a JSON string", '"t1"'],
    ["a JSON number", "42"],
    ["JSON null", "null"],
  ])("returns %s under `unparsed` rather than throwing", (_, stored) => {
    expect(toLogEntryDTO({ ...ROW, detail: stored }).detail).toEqual({ unparsed: stored });
  });

  it("survives a damaged row in a batch, mapping the rest normally", () => {
    const rows = [
      { ...ROW, id: "a", detail: '{"ok":true}' },
      { ...ROW, id: "b", detail: "{oops" },
      { ...ROW, id: "c", detail: null },
    ];
    expect(rows.map(toLogEntryDTO).map((e) => e.detail)).toEqual([
      { ok: true },
      { unparsed: "{oops" },
      null,
    ]);
  });
});

describe("sourceOf", () => {
  it.each([
    ["auth.signed_in", "auth"],
    ["auth.sign_in_failed", "auth"],
    ["auth.signed_out", "auth"],
    ["task.created", "tasks"],
    ["task.updated", "tasks"],
    ["task.deleted", "tasks"],
    ["category.created", "categories"],
    ["category.deleted", "categories"],
    ["server.started", "system"],
    ["server.config_invalid", "system"],
    ["action.unexpected_error", "system"],
    ["log.write_failed", "system"],
    ["log.purged", "system"],
  ])("puts %s under %s", (event, source) => {
    expect(sourceOf(event)).toBe(source);
  });

  it.each([
    ["a name that only begins like a prefix", "tasks.created"],
    ["a prefix without its dot", "authentication.failed"],
    ["a prefix in the wrong case", "Task.created"],
    ["the prefix's word later in the name", "server.task.created"],
  ])("puts %s under system", (_, event) => {
    expect(sourceOf(event)).toBe("system");
  });

  it("gives every source but system a prefix ending in a dot", () => {
    expect(Object.keys(SOURCE_PREFIXES)).toEqual(["auth", "tasks", "categories"]);
    for (const prefix of Object.values(SOURCE_PREFIXES)) expect(prefix).toMatch(/^[a-z]+\.$/);
  });
});
