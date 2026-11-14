import { describe, it, expect } from "vitest";
import type { LogModel } from "@/generated/prisma-sqlite/models";
import { toLogEntryDTO } from "@/src/shared/lib/dtos/logs";

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
      message: "Deleted a task",
      detail: null,
    });
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
