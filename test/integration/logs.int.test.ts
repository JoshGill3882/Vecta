import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { prisma } from "@/src/server/db";
import {
  DEFAULT_LOG_LIST,
  LOG_BATCH_SIZE,
  MAX_LOG_LIST,
  listLogPage,
  listLogs,
  readLogBatches,
  writeLog,
} from "@/src/server/services/logs";
import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { LOG_PAGE_SIZE, type LogFilters } from "@/src/shared/lib/schemas/logs";

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

describe("listLogPage (integration)", () => {
  /** Builds the page's filters, with none on and the first page unless a test says otherwise.
   *
   * @param change The filters or page that differ from that.
   * @returns The full set of filters.
   */
  function filters(change: Partial<LogFilters> = {}): LogFilters {
    return { level: [], source: [], page: 1, ...change };
  }

  /** One entry from each source, at the levels the filter tests pick between. */
  const MIXED = [
    { event: "auth.sign_in_failed", level: "warn" },
    { event: "auth.signed_in", level: "info" },
    { event: "task.created", level: "info" },
    { event: "task.deleted", level: "warn" },
    { event: "category.deleted", level: "info" },
    { event: "server.started", level: "info" },
    { event: "action.unexpected_error", level: "error" },
    { event: "log.write_failed", level: "error" },
  ];

  it("describes an empty log", async () => {
    expect(await listLogPage(filters())).toEqual({
      entries: [],
      page: 1,
      pageCount: 1,
      matching: 0,
      total: 0,
      oldest: null,
      levelCounts: { debug: 0, info: 0, warn: 0, error: 0 },
      sourceCounts: { auth: 0, tasks: 0, categories: 0, system: 0 },
    });
  });

  it(`shows ${LOG_PAGE_SIZE} entries a page, newest first`, async () => {
    await seed(Array.from({ length: LOG_PAGE_SIZE * 2 + 20 }, () => ({})));

    const first = await listLogPage(filters());
    expect(first.entries).toHaveLength(LOG_PAGE_SIZE);
    expect(first.entries[0].event).toBe(`test.entry_${LOG_PAGE_SIZE * 2 + 19}`);
    expect(first).toMatchObject({ page: 1, pageCount: 3, matching: 120, total: 120 });

    const last = await listLogPage(filters({ page: 3 }));
    expect(last.entries.map((e) => e.event)).toEqual(
      Array.from({ length: 20 }, (_, i) => `test.entry_${19 - i}`)
    );
  });

  it("follows on from one page to the next without a gap or a repeat", async () => {
    await seed(Array.from({ length: LOG_PAGE_SIZE + 10 }, () => ({})));

    const ids = [
      ...(await listLogPage(filters({ page: 1 }))).entries,
      ...(await listLogPage(filters({ page: 2 }))).entries,
    ].map((e) => e.id);
    expect(new Set(ids).size).toBe(LOG_PAGE_SIZE + 10);
  });

  it("splits entries written in the same millisecond across pages the same way every time", async () => {
    const at = new Date("2026-11-14T09:00:00.000Z");
    const ids = Array.from(
      { length: LOG_PAGE_SIZE + 1 },
      (_, i) => `id${String(i).padStart(3, "0")}`
    );
    await prisma.log.createMany({
      data: ids.map((id) => ({
        id,
        createdAt: at,
        kind: "operational",
        level: "info",
        event: "test.tied",
        message: id,
      })),
    });

    const second = await listLogPage(filters({ page: 2 }));
    expect(second.entries.map((e) => e.id)).toEqual(["id000"]);
  });

  it("shows the last page for a page past it", async () => {
    await seed(Array.from({ length: LOG_PAGE_SIZE + 5 }, () => ({})));

    const result = await listLogPage(filters({ page: 9 }));
    expect(result).toMatchObject({ page: 2, pageCount: 2 });
    expect(result.entries).toHaveLength(5);
  });

  it("shows the first page, empty, when nothing matches whatever page is asked for", async () => {
    await seed([{ level: "info" }]);

    const result = await listLogPage(filters({ level: ["error"], page: 4 }));
    expect(result).toMatchObject({ entries: [], page: 1, pageCount: 1, matching: 0, total: 1 });
  });

  it("filters by several levels at once", async () => {
    await seed(MIXED);

    const result = await listLogPage(filters({ level: ["warn", "error"] }));
    expect(result.entries.map((e) => e.level).sort()).toEqual(["error", "error", "warn", "warn"]);
    expect(result.matching).toBe(4);
  });

  it.each([
    ["auth", ["auth.signed_in", "auth.sign_in_failed"]],
    ["tasks", ["task.deleted", "task.created"]],
    ["categories", ["category.deleted"]],
    ["system", ["log.write_failed", "action.unexpected_error", "server.started"]],
  ] as const)("filters by the source %s", async (source, events) => {
    await seed(MIXED);

    const result = await listLogPage(filters({ source: [source] }));
    expect(result.entries.map((e) => e.event)).toEqual(events);
    expect(result.entries.every((e) => e.source === source)).toBe(true);
  });

  it("filters by several sources at once", async () => {
    await seed(MIXED);

    const result = await listLogPage(filters({ source: ["categories", "system"] }));
    expect(result.matching).toBe(4);
  });

  it("narrows by level and source together", async () => {
    await seed(MIXED);

    const result = await listLogPage(filters({ level: ["warn"], source: ["auth", "system"] }));
    expect(result.entries.map((e) => e.event)).toEqual(["auth.sign_in_failed"]);
  });

  it("does not count an event that only looks like a source's under that source", async () => {
    await seed([{ event: "tasks.created" }, { event: "server.task_created" }]);

    const result = await listLogPage(filters({ source: ["tasks"] }));
    expect(result.matching).toBe(0);
    expect(result.sourceCounts).toMatchObject({ tasks: 0, system: 2 });
  });

  it("counts every entry by level and by source, whatever the filters", async () => {
    await seed(MIXED);

    const result = await listLogPage(filters({ level: ["error"], source: ["system"] }));
    expect(result).toMatchObject({
      matching: 2,
      total: 8,
      levelCounts: { debug: 0, info: 4, warn: 2, error: 2 },
      sourceCounts: { auth: 2, tasks: 2, categories: 1, system: 3 },
    });
  });

  it("gives the time of the oldest entry, whatever the filters", async () => {
    await seed([{ level: "info" }, { level: "error" }]);

    const result = await listLogPage(filters({ level: ["error"] }));
    expect(result.oldest).toBe("2026-11-14T09:00:00.000Z");
  });

  it("gives each entry its source", async () => {
    await seed([{ event: "category.created" }, { event: "auth.signed_out" }]);

    const { entries } = await listLogPage(filters());
    expect(entries.map((e) => e.source)).toEqual(["auth", "categories"]);
  });
});

describe("readLogBatches (integration)", () => {
  /** No filters on, as an unfiltered export reads. */
  const NONE = { level: [], source: [] };

  /** Reads every batch an export would.
   *
   * @param batches The batches being read.
   * @returns Each batch's entries, in the order they came.
   */
  async function collect(batches: AsyncIterable<LogEntryDTO[]>): Promise<LogEntryDTO[][]> {
    const read: LogEntryDTO[][] = [];
    for await (const batch of batches) read.push(batch);
    return read;
  }

  it("reads nothing from an empty log", async () => {
    expect(await collect(readLogBatches(NONE))).toEqual([]);
  });

  it(`reads ${LOG_BATCH_SIZE} entries a batch unless told otherwise`, async () => {
    await seed(Array.from({ length: LOG_BATCH_SIZE + 1 }, () => ({})));

    const sizes = (await collect(readLogBatches(NONE))).map((batch) => batch.length);
    expect(sizes).toEqual([LOG_BATCH_SIZE, 1]);
  });

  it("reads every entry once, newest first, across batches", async () => {
    await seed(Array.from({ length: 7 }, () => ({})));

    const batches = await collect(readLogBatches(NONE, 3));
    expect(batches.map((batch) => batch.length)).toEqual([3, 3, 1]);
    expect(batches.flat().map((e) => e.event)).toEqual(
      Array.from({ length: 7 }, (_, i) => `test.entry_${6 - i}`)
    );
  });

  it("ends without an empty batch when the entries fill the last one exactly", async () => {
    await seed(Array.from({ length: 6 }, () => ({})));

    expect((await collect(readLogBatches(NONE, 3))).map((batch) => batch.length)).toEqual([3, 3]);
  });

  it("splits entries written in the same millisecond across batches without a gap or a repeat", async () => {
    const at = new Date("2026-11-14T09:00:00.000Z");
    const ids = ["a", "b", "c", "d", "e"];
    await prisma.log.createMany({
      data: ids.map((id) => ({
        id,
        createdAt: at,
        kind: "operational",
        level: "info",
        event: "test.tied",
        message: id,
      })),
    });

    const batches = await collect(readLogBatches(NONE, 2));
    expect(batches.map((batch) => batch.map((e) => e.id))).toEqual([["e", "d"], ["c", "b"], ["a"]]);
  });

  it("neither repeats nor includes an entry written between batches", async () => {
    await seed(Array.from({ length: 4 }, () => ({})));

    const read: string[] = [];
    for await (const batch of readLogBatches(NONE, 2)) {
      read.push(...batch.map((e) => e.event));
      if (read.length === 2) await writeLog({ ...ENTRY, event: "test.written_meanwhile" });
    }

    expect(read).toEqual(["test.entry_3", "test.entry_2", "test.entry_1", "test.entry_0"]);
  });

  it("reads only the entries the levels and sources match, ignoring any page", async () => {
    await seed([
      { event: "auth.sign_in_failed", level: "warn" },
      { event: "auth.signed_in", level: "info" },
      { event: "task.deleted", level: "warn" },
      { event: "server.started", level: "info" },
      { event: "action.unexpected_error", level: "error" },
    ]);

    const filters: LogFilters = { level: ["warn", "error"], source: ["auth", "system"], page: 9 };
    const events = (await collect(readLogBatches(filters, 1))).flat().map((e) => e.event);
    expect(events).toEqual(["action.unexpected_error", "auth.sign_in_failed"]);
  });

  it("reads each entry as the Logs page shows it, with its detail parsed", async () => {
    await seed([{ event: "task.deleted", detail: '{"id":"t1"}' }, { detail: "{oops" }]);

    const [batch] = await collect(readLogBatches(NONE));
    expect(batch.map((e) => [e.source, e.detail])).toEqual([
      ["system", { unparsed: "{oops" }],
      ["tasks", { id: "t1" }],
    ]);
  });
});
