import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { prisma } from "@/src/server/db";
import { DEFAULT_LOG_LIST, MAX_LOG_LIST, listLogs, writeLog } from "@/src/server/services/logs";

const ENTRY = {
  kind: "activity",
  level: "info",
  event: "task.deleted",
  message: "Deleted a task",
} as const;

/** Inserts rows directly, one second apart, oldest first.
 *
 * Bypasses the service so a test controls each entry's time and can store
 * what the service would refuse.
 *
 * @param rows The fields that differ from a plain operational info entry.
 * @returns Nothing; the rows are in the table.
 */
async function seed(
  rows: { kind?: string; level?: string; event?: string; detail?: string | null }[]
): Promise<void> {
  const start = Date.parse("2026-11-14T09:00:00.000Z");
  await prisma.log.createMany({
    data: rows.map((row, i) => ({
      kind: "operational",
      level: "info",
      event: `test.entry_${i}`,
      message: `Entry ${i}`,
      ...row,
      createdAt: new Date(start + i * 1000),
    })),
  });
}

describe("writeLog (integration)", () => {
  it("stores the entry and returns it as a DTO", async () => {
    const entry = await writeLog({ ...ENTRY, detail: { id: "t1", title: "Renew" } });

    expect(entry).toMatchObject({ ...ENTRY, detail: { id: "t1", title: "Renew" } });
    expect(Date.parse(entry.createdAt)).not.toBeNaN();
    const row = await prisma.log.findUniqueOrThrow({ where: { id: entry.id } });
    expect(row).toMatchObject(ENTRY);
  });

  it("serialises detail to JSON text in the column", async () => {
    const entry = await writeLog({ ...ENTRY, detail: { id: "t1", changed: ["title"] } });

    const row = await prisma.log.findUniqueOrThrow({ where: { id: entry.id } });
    expect(row.detail).toBe('{"id":"t1","changed":["title"]}');
  });

  it("stores no detail as null, not as an empty object", async () => {
    const entry = await writeLog(ENTRY);

    expect(entry.detail).toBeNull();
    const row = await prisma.log.findUniqueOrThrow({ where: { id: entry.id } });
    expect(row.detail).toBeNull();
  });

  it("round-trips nested detail, with a Date as its ISO string", async () => {
    const at = new Date("2026-11-14T10:00:00.000Z");
    await writeLog({ ...ENTRY, detail: { task: { id: "t1", dueAt: null }, at } });

    const [entry] = await listLogs();
    expect(entry.detail).toEqual({ task: { id: "t1", dueAt: null }, at: at.toISOString() });
  });

  it.each([
    ["an unknown kind", { kind: "audit" }],
    ["an unknown level", { level: "fatal" }],
    ["a malformed event", { event: "Task Deleted" }],
    ["an empty message", { message: "" }],
    ["detail that is not an object", { detail: ["t1"] }],
  ])("rejects %s with a ZodError and writes nothing", async (_, change) => {
    // The cast stands in for a caller that skipped the type checker.
    await expect(writeLog({ ...ENTRY, ...change } as never)).rejects.toThrow(ZodError);
    expect(await prisma.log.count()).toBe(0);
  });

  it("rejects detail that cannot be serialised and writes nothing", async () => {
    const detail: Record<string, unknown> = { id: "t1" };
    detail.self = detail;

    await expect(writeLog({ ...ENTRY, detail })).rejects.toThrow(TypeError);
    expect(await prisma.log.count()).toBe(0);
  });

  it("keeps an entry after the task it describes is deleted", async () => {
    const task = await prisma.task.create({ data: { title: "Renew", status: "open" } });
    await writeLog({ ...ENTRY, detail: { id: task.id, title: task.title } });

    await prisma.task.delete({ where: { id: task.id } });

    const [entry] = await listLogs();
    expect(entry.detail).toEqual({ id: task.id, title: "Renew" });
  });
});

describe("listLogs (integration)", () => {
  it("lists entries newest first", async () => {
    await seed([{ event: "test.first" }, { event: "test.second" }, { event: "test.third" }]);

    const events = (await listLogs()).map((e) => e.event);
    expect(events).toEqual(["test.third", "test.second", "test.first"]);
  });

  it("orders entries written in the same millisecond the same way every time", async () => {
    const at = new Date("2026-11-14T09:00:00.000Z");
    await prisma.log.createMany({
      data: ["a", "b", "c", "d"].map((id) => ({
        id,
        createdAt: at,
        kind: "operational",
        level: "info",
        event: "test.tied",
        message: id,
      })),
    });

    expect((await listLogs()).map((e) => e.id)).toEqual(["d", "c", "b", "a"]);
  });

  it("filters by kind", async () => {
    await seed([{ kind: "activity" }, { kind: "operational" }, { kind: "activity" }]);

    const entries = await listLogs({ kind: "activity" });
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.kind === "activity")).toBe(true);
  });

  it("filters by level", async () => {
    await seed([{ level: "error" }, { level: "info" }, { level: "error" }, { level: "warn" }]);

    const entries = await listLogs({ level: "error" });
    expect(entries.map((e) => e.level)).toEqual(["error", "error"]);
  });

  it("filters by kind and level together", async () => {
    await seed([
      { kind: "activity", level: "error" },
      { kind: "operational", level: "error" },
      { kind: "activity", level: "info" },
    ]);

    const entries = await listLogs({ kind: "activity", level: "error" });
    expect(entries.map((e) => [e.kind, e.level])).toEqual([["activity", "error"]]);
  });

  it("lists every kind and level when no filter is given", async () => {
    await seed([
      { kind: "activity", level: "debug" },
      { kind: "operational", level: "error" },
    ]);

    expect(await listLogs()).toHaveLength(2);
  });

  it("returns the newest entries up to the limit", async () => {
    await seed([{ event: "test.a" }, { event: "test.b" }, { event: "test.c" }]);

    expect((await listLogs({ limit: 2 })).map((e) => e.event)).toEqual(["test.c", "test.b"]);
  });

  it(`returns ${DEFAULT_LOG_LIST} entries when no limit is given`, async () => {
    await seed(Array.from({ length: DEFAULT_LOG_LIST + 5 }, () => ({})));

    expect(await listLogs()).toHaveLength(DEFAULT_LOG_LIST);
  });

  it(`returns at most ${MAX_LOG_LIST} entries, however many are asked for`, async () => {
    await seed(Array.from({ length: MAX_LOG_LIST + 5 }, () => ({})));

    expect(await listLogs({ limit: MAX_LOG_LIST + 100 })).toHaveLength(MAX_LOG_LIST);
    expect(await listLogs({ limit: Infinity })).toHaveLength(MAX_LOG_LIST);
  });

  it.each([
    ["zero", 0, 1],
    ["a negative number", -5, 1],
    ["a fraction", 2.9, 2],
    ["NaN", NaN, 3],
  ])("keeps a limit of %s within range", async (_, limit, expected) => {
    await seed([{}, {}, {}]);

    expect(await listLogs({ limit })).toHaveLength(expected);
  });

  it("reads a damaged detail under `unparsed` and the rest of the listing normally", async () => {
    await seed([{ detail: '{"id":"t1"}' }, { detail: "{oops" }, { detail: null }]);

    expect((await listLogs()).map((e) => e.detail)).toEqual([
      null,
      { unparsed: "{oops" },
      { id: "t1" },
    ]);
  });
});
