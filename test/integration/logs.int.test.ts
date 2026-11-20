import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { prisma } from "@/src/server/db";
import {
  DEFAULT_LOG_LIST,
  LOG_BATCH_SIZE,
  MAX_LOG_LIST,
  countLogsSince,
  deleteLogs,
  listLogPage,
  listLogs,
  readLogBatches,
  writeLog,
} from "@/src/server/services/logs";
import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { LOG_PAGE_SIZE, NO_FILTERS, type LogFilters } from "@/src/shared/lib/schemas/logs";

const ENTRY = {
  kind: "activity",
  level: "info",
  event: "task.deleted",
  message: "Deleted a task",
} as const;

/** Inserts rows directly, one second apart, oldest first, unless a row gives its own time.
 *
 * Bypasses the service so a test controls each entry's time and can store
 * what the service would refuse.
 *
 * @param rows The fields that differ from a plain operational info entry.
 * @returns Nothing; the rows are in the table.
 */
async function seed(
  rows: {
    kind?: string;
    level?: string;
    event?: string;
    message?: string;
    detail?: string | null;
    createdAt?: Date;
  }[]
): Promise<void> {
  const start = Date.parse("2026-11-14T09:00:00.000Z");
  await prisma.log.createMany({
    data: rows.map((row, i) => ({
      kind: "operational",
      level: "info",
      event: `test.entry_${i}`,
      message: `Entry ${i}`,
      createdAt: new Date(start + i * 1000),
      ...row,
    })),
  });
}

/** A moment some hours before another.
 *
 * @param hours How many hours before.
 * @param from The moment to count back from.
 * @returns The earlier moment.
 */
function hoursBefore(hours: number, from: Date): Date {
  return new Date(from.getTime() - hours * 60 * 60 * 1000);
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
    return { ...NO_FILTERS, page: 1, ...change };
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
      readAt: expect.any(String),
    });
  });

  it("says when its counts were read", async () => {
    const before = Date.now();
    const { readAt } = await listLogPage(filters());
    const after = Date.now();

    expect(new Date(readAt).toISOString()).toBe(readAt);
    expect(Date.parse(readAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(readAt)).toBeLessThanOrEqual(after);
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

  it("leaves an entry written after its counts were read out of the page and every count", async () => {
    // An entry dated ahead of the clock stands in for one written while the
    // page is read, after the moment it is read up to.
    const later = new Date(Date.now() + 60 * 60 * 1000);
    await seed([
      { event: "task.created", level: "info" },
      { event: "auth.sign_in_failed", level: "warn", createdAt: later },
    ]);

    const result = await listLogPage(filters());
    expect(result.entries.map((e) => e.event)).toEqual(["task.created"]);
    expect(result).toMatchObject({
      matching: 1,
      total: 1,
      levelCounts: { debug: 0, info: 1, warn: 0, error: 0 },
      sourceCounts: { auth: 0, tasks: 1, categories: 0, system: 0 },
    });
  });

  it("leaves an entry written after its counts were read out of a search's matches", async () => {
    const later = new Date(Date.now() + 60 * 60 * 1000);
    await seed([{ message: "Bought milk" }, { message: "Bought more milk", createdAt: later }]);

    const result = await listLogPage(filters({ q: "milk" }));
    expect(result.entries.map((e) => e.message)).toEqual(["Bought milk"]);
    expect(result.matching).toBe(1);
  });

  it("gives no oldest entry when every entry was written after its counts were read", async () => {
    await seed([{ createdAt: new Date(Date.now() + 60 * 60 * 1000) }]);

    expect(await listLogPage(filters())).toMatchObject({ total: 0, oldest: null, entries: [] });
  });

  it("searches the message a row shows, the stored message, the event and the detail's values", async () => {
    await seed([
      { event: "task.deleted", message: "Task deleted", detail: '{"title":"Buy milk"}' },
      { event: "category.created", message: "Category created", detail: '{"name":"Home"}' },
      { event: "server.started", message: "Server started", detail: '{"version":"1.3.0"}' },
      {
        event: "auth.sign_in_failed",
        message: "Sign-in failed",
        detail: '{"reason":"rate_limited"}',
      },
    ]);

    /** The events of the entries a search lists.
     *
     * @param q The search as typed.
     * @returns Each listed entry's event, newest first.
     */
    async function found(q: string): Promise<string[]> {
      return (await listLogPage(filters({ q }))).entries.map((e) => e.event);
    }

    expect(await found("deleted “buy")).toEqual(["task.deleted"]);
    expect(await found("too many attempts")).toEqual(["auth.sign_in_failed"]);
    expect(await found("category created")).toEqual(["category.created"]);
    expect(await found("server.st")).toEqual(["server.started"]);
    expect(await found("1.3.0")).toEqual(["server.started"]);
    expect(await found("version")).toEqual([]);
  });

  it("counts and pages only the entries the search matches, newest first", async () => {
    await seed(
      Array.from({ length: LOG_PAGE_SIZE * 2 + 20 }, (_, i) => ({
        message: i % 2 === 0 ? `Milk run ${i}` : `Errand ${i}`,
      }))
    );

    const first = await listLogPage(filters({ q: "milk" }));
    expect(first).toMatchObject({ matching: LOG_PAGE_SIZE + 10, pageCount: 2, page: 1 });
    expect(first.entries).toHaveLength(LOG_PAGE_SIZE);
    expect(first.entries[0].message).toBe(`Milk run ${LOG_PAGE_SIZE * 2 + 18}`);

    const second = await listLogPage(filters({ q: "milk", page: 2 }));
    expect(second.entries.map((e) => e.message)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Milk run ${18 - i * 2}`)
    );
  });

  it("shows the last page of the matches for a page past it", async () => {
    await seed([{ message: "Milk" }, { message: "Eggs" }]);

    expect(await listLogPage(filters({ q: "milk", page: 5 }))).toMatchObject({
      page: 1,
      pageCount: 1,
      matching: 1,
    });
  });

  it.each([
    ["%", "50% done", "500 done"],
    ["_", "a_b", "axb"],
  ])("searches for %j as text, not as a database wildcard", async (q, holds, lacks) => {
    // An event of its own, since the seeded ones hold an underscore.
    await seed([
      { event: "test.wildcard", message: holds },
      { event: "test.wildcard", message: lacks },
    ]);

    const { entries, matching } = await listLogPage(filters({ q }));
    expect(matching).toBe(1);
    expect(entries.map((e) => e.message)).toEqual([holds]);
  });

  it("searches ignoring case, accented letters included", async () => {
    await seed([{ message: "Écrire le rapport" }, { message: "Lire le rapport" }]);

    const { entries } = await listLogPage(filters({ q: "ÉCRIRE" }));
    expect(entries.map((e) => e.message)).toEqual(["Écrire le rapport"]);
  });

  it("narrows a search by level and source as well", async () => {
    await seed([
      { event: "task.deleted", level: "warn", message: "Milk" },
      { event: "task.deleted", level: "info", message: "Milk" },
      { event: "auth.signed_in", level: "warn", message: "Milk" },
      { event: "task.deleted", level: "warn", message: "Eggs" },
    ]);

    const page = await listLogPage(filters({ q: "milk", level: ["warn"], source: ["tasks"] }));
    expect(page.matching).toBe(1);
    expect(page.entries.map((e) => [e.event, e.level, e.message])).toEqual([
      ["task.deleted", "warn", "Milk"],
    ]);
  });

  it.each([
    [null, 4],
    ["30d", 3],
    ["7d", 2],
    ["24h", 1],
  ] as const)("with the range %j, counts the entries written within it", async (range, count) => {
    const now = new Date();
    await seed([
      { event: "test.forty_days", createdAt: hoursBefore(40 * 24, now) },
      { event: "test.ten_days", createdAt: hoursBefore(10 * 24, now) },
      { event: "test.three_days", createdAt: hoursBefore(3 * 24, now) },
      { event: "test.two_hours", createdAt: hoursBefore(2, now) },
    ]);

    const page = await listLogPage(filters({ range }));
    expect(page.matching).toBe(count);
    expect(page.entries).toHaveLength(count);
  });

  it("measures the range back from when its counts were read", async () => {
    const now = new Date();
    await seed([
      { event: "test.outside", createdAt: hoursBefore(24.01, now) },
      { event: "test.inside", createdAt: hoursBefore(23.99, now) },
    ]);

    const page = await listLogPage(filters({ range: "24h" }));
    expect(page.entries.map((e) => e.event)).toEqual(["test.inside"]);
  });

  it("narrows a search by the range as well", async () => {
    const now = new Date();
    await seed([
      { message: "Milk", createdAt: hoursBefore(48, now) },
      { message: "Milk", createdAt: hoursBefore(1, now) },
      { message: "Eggs", createdAt: hoursBefore(1, now) },
    ]);

    expect((await listLogPage(filters({ q: "milk", range: "24h" }))).matching).toBe(1);
  });

  it("counts every entry by level and source, whatever the search and range", async () => {
    await seed([
      { level: "warn", message: "Milk" },
      { level: "error" },
      { event: "auth.signed_in" },
    ]);

    const page = await listLogPage(filters({ q: "milk", range: "24h" }));
    expect(page).toMatchObject({
      matching: 0,
      total: 3,
      levelCounts: { debug: 0, info: 1, warn: 1, error: 1 },
      sourceCounts: { auth: 1, tasks: 0, categories: 0, system: 2 },
    });
  });

  it("gives each entry its source", async () => {
    await seed([{ event: "category.created" }, { event: "auth.signed_out" }]);

    const { entries } = await listLogPage(filters());
    expect(entries.map((e) => e.source)).toEqual(["auth", "categories"]);
  });
});

describe("countLogsSince (integration)", () => {
  /** The seeded entries' second one, at 09:00:01: entries 2 onwards are after it. */
  const MOMENT = new Date("2026-11-14T09:00:01.000Z");

  it("counts nothing in an empty log", async () => {
    expect(await countLogsSince(NO_FILTERS, MOMENT)).toBe(0);
  });

  it("counts only the entries written after the moment, not one written at it", async () => {
    await seed(Array.from({ length: 5 }, () => ({})));

    expect(await countLogsSince(NO_FILTERS, MOMENT)).toBe(3);
  });

  it("counts nothing when nothing was written after the moment", async () => {
    await seed(Array.from({ length: 2 }, () => ({})));

    expect(await countLogsSince(NO_FILTERS, MOMENT)).toBe(0);
  });

  it("counts only the entries the levels and sources match", async () => {
    await seed([
      { event: "auth.sign_in_failed", level: "warn" },
      { event: "auth.sign_in_failed", level: "warn" },
      { event: "auth.sign_in_failed", level: "warn" },
      { event: "auth.signed_in", level: "info" },
      { event: "task.created", level: "warn" },
    ]);

    const filters = { ...NO_FILTERS, level: ["warn" as const], source: ["auth" as const] };
    expect(await countLogsSince(filters, MOMENT)).toBe(1);
  });

  it("counts only the entries the search matches", async () => {
    await seed([
      { message: "Bought milk" },
      { message: "Bought milk" },
      { message: "Bought more milk" },
      { message: "Bought eggs" },
      { message: "Spilt the MILK" },
    ]);

    expect(await countLogsSince({ ...NO_FILTERS, q: "milk" }, MOMENT)).toBe(2);
  });

  it("measures the range back from now, not from the moment", async () => {
    const now = new Date();
    await seed([
      { event: "test.outside", createdAt: hoursBefore(30, now) },
      { event: "test.inside", createdAt: hoursBefore(1, now) },
    ]);

    const since = hoursBefore(48, now);
    expect(await countLogsSince({ ...NO_FILTERS, range: "24h" }, since)).toBe(1);
    expect(await countLogsSince(NO_FILTERS, since)).toBe(2);
  });

  it("counts an entry the page's own read left out as written after it", async () => {
    const later = new Date(Date.now() + 60 * 60 * 1000);
    await seed([{}, { createdAt: later }]);

    const { readAt, total } = await listLogPage({ ...NO_FILTERS, page: 1 });
    expect(total).toBe(1);
    expect(await countLogsSince(NO_FILTERS, new Date(readAt))).toBe(1);
  });
});

describe("readLogBatches (integration)", () => {
  /** No filters on, as an unfiltered export reads. */
  const NONE = NO_FILTERS;

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

    const filters: LogFilters = {
      ...NO_FILTERS,
      level: ["warn", "error"],
      source: ["auth", "system"],
      page: 9,
    };
    const events = (await collect(readLogBatches(filters, 1))).flat().map((e) => e.event);
    expect(events).toEqual(["action.unexpected_error", "auth.sign_in_failed"]);
  });

  it("reads only entries written up to the moment the counts were read, when given one", async () => {
    await seed(Array.from({ length: 5 }, () => ({})));

    const readAt = new Date("2026-11-14T09:00:02.000Z");
    const events = (await collect(readLogBatches({ ...NONE, readAt }, 2))).flat();
    expect(events.map((e) => e.event)).toEqual(["test.entry_2", "test.entry_1", "test.entry_0"]);
  });

  it("reads the entries a purge would delete, filters and moment together", async () => {
    await seed([{ level: "error" }, { level: "info" }, { level: "error" }, { level: "error" }]);

    const readAt = new Date("2026-11-14T09:00:02.000Z");
    const [batch] = await collect(readLogBatches({ ...NO_FILTERS, level: ["error"], readAt }));
    expect(batch.map((e) => e.event)).toEqual(["test.entry_2", "test.entry_0"]);
  });

  it("reads only the entries the search matches, in batches that are never empty", async () => {
    await seed(
      Array.from({ length: 7 }, (_, i) => ({ message: i === 1 || i >= 5 ? "Milk" : "Eggs" }))
    );

    const batches = await collect(readLogBatches({ ...NONE, q: "MILK" }, 2));
    // Read two at a time: entries 6 and 5 match, 4 and 3 do not, 2 and 1 hold
    // one match, and 0 does not.
    expect(batches.map((batch) => batch.map((e) => e.event))).toEqual([
      ["test.entry_6", "test.entry_5"],
      ["test.entry_1"],
    ]);
  });

  it("reads a search's matches written up to the moment, when given one", async () => {
    await seed([
      { message: "Milk" },
      { message: "Eggs" },
      { message: "Milk" },
      { message: "Milk" },
    ]);

    const readAt = new Date("2026-11-14T09:00:02.000Z");
    const [batch] = await collect(readLogBatches({ ...NONE, q: "milk", readAt }));
    expect(batch.map((e) => e.event)).toEqual(["test.entry_2", "test.entry_0"]);
  });

  it("reads the range back from the moment, when given one", async () => {
    const readAt = new Date("2026-11-14T12:00:00.000Z");
    await seed([
      { event: "test.before_range", createdAt: hoursBefore(25, readAt) },
      { event: "test.in_range", createdAt: hoursBefore(23, readAt) },
      { event: "test.at_moment", createdAt: readAt },
      { event: "test.after_moment", createdAt: hoursBefore(-1, readAt) },
    ]);

    const [batch] = await collect(readLogBatches({ ...NONE, range: "24h", readAt }));
    expect(batch.map((e) => e.event)).toEqual(["test.at_moment", "test.in_range"]);
  });

  it("reads the range back from now, with no moment", async () => {
    const now = new Date();
    await seed([
      { event: "test.old", createdAt: hoursBefore(8 * 24, now) },
      { event: "test.recent", createdAt: hoursBefore(6 * 24, now) },
    ]);

    const [batch] = await collect(readLogBatches({ ...NONE, range: "7d" }));
    expect(batch.map((e) => e.event)).toEqual(["test.recent"]);
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

describe("deleteLogs (integration)", () => {
  /** No filters on, as a purge of every entry deletes. */
  const NONE = NO_FILTERS;

  /** The moment the third seeded entry was written, two seconds after the first. */
  const THIRD = new Date("2026-11-14T09:00:02.000Z");

  /** The events of the entries left, newest first.
   *
   * @returns Each remaining entry's event.
   */
  async function remaining(): Promise<string[]> {
    return (await listLogs()).map((e) => e.event);
  }

  it("deletes every entry written up to the moment, and says how many", async () => {
    await seed([{}, {}, {}]);

    expect(await deleteLogs(NONE, THIRD)).toBe(3);
    expect(await remaining()).toEqual([]);
  });

  it("keeps an entry written after the moment", async () => {
    await seed([{}, {}, {}, {}, {}]);

    expect(await deleteLogs(NONE, THIRD)).toBe(3);
    expect(await remaining()).toEqual(["test.entry_4", "test.entry_3"]);
  });

  it("deletes an entry written at the moment itself", async () => {
    await seed([{}, {}, {}]);

    await deleteLogs(NONE, THIRD);
    expect(await remaining()).not.toContain("test.entry_2");
  });

  it("deletes only the entries the levels and sources match", async () => {
    await seed([
      { event: "auth.sign_in_failed", level: "warn" },
      { event: "auth.signed_in", level: "info" },
      { event: "task.deleted", level: "warn" },
      { event: "server.started", level: "info" },
      { event: "action.unexpected_error", level: "error" },
    ]);

    const removed = await deleteLogs(
      { ...NO_FILTERS, level: ["warn", "error"], source: ["auth", "system"] },
      new Date("2026-11-14T10:00:00.000Z")
    );

    expect(removed).toBe(2);
    expect(await remaining()).toEqual(["server.started", "task.deleted", "auth.signed_in"]);
  });

  it("keeps a matching entry written after the moment", async () => {
    await seed([{ level: "error" }, { level: "error" }, { level: "error" }, { level: "error" }]);

    expect(await deleteLogs({ ...NO_FILTERS, level: ["error"] }, THIRD)).toBe(3);
    expect(await remaining()).toEqual(["test.entry_3"]);
  });

  it("deletes nothing, and says so, when nothing matches", async () => {
    await seed([{ level: "info" }]);

    expect(await deleteLogs({ ...NO_FILTERS, level: ["error"] }, THIRD)).toBe(0);
    expect(await remaining()).toHaveLength(1);
  });

  it("deletes only the entries the search matches, written up to the moment", async () => {
    await seed([
      { message: "Milk" },
      { message: "Eggs" },
      { message: "MILK" },
      { message: "Milk" },
    ]);

    expect(await deleteLogs({ ...NONE, q: "milk" }, THIRD)).toBe(2);
    expect(await remaining()).toEqual(["test.entry_3", "test.entry_1"]);
  });

  it("deletes a search's matches together with the other filters", async () => {
    await seed([
      { level: "warn", message: "Milk" },
      { level: "info", message: "Milk" },
      { level: "warn", message: "Eggs" },
    ]);

    expect(await deleteLogs({ ...NONE, q: "milk", level: ["warn"] }, THIRD)).toBe(1);
    expect(await remaining()).toEqual(["test.entry_2", "test.entry_1"]);
  });

  it("treats a wildcard character in the search as text", async () => {
    await seed([{ message: "50% done" }, { message: "500 done" }, { message: "a_b" }]);

    expect(await deleteLogs({ ...NONE, q: "%" }, THIRD)).toBe(1);
    expect(await remaining()).toEqual(["test.entry_2", "test.entry_1"]);
  });

  it(`deletes more matches than one delete of ${LOG_BATCH_SIZE} holds`, async () => {
    const count = LOG_BATCH_SIZE * 2 + 3;
    await seed(
      Array.from({ length: count + 4 }, (_, i) => ({ message: i < count ? "Milk" : "Eggs" }))
    );

    expect(await deleteLogs({ ...NONE, q: "milk" }, new Date("2026-11-15T00:00:00.000Z"))).toBe(
      count
    );
    expect(await prisma.log.count()).toBe(4);
  });

  it("deletes nothing, and says so, when the search matches nothing", async () => {
    await seed([{ message: "Eggs" }]);

    expect(await deleteLogs({ ...NONE, q: "milk" }, THIRD)).toBe(0);
    expect(await remaining()).toHaveLength(1);
  });

  it("deletes only the entries within the range of the moment", async () => {
    const readAt = new Date("2026-11-14T12:00:00.000Z");
    await seed([
      { event: "test.before_range", createdAt: hoursBefore(25, readAt) },
      { event: "test.in_range", createdAt: hoursBefore(23, readAt) },
      { event: "test.after_moment", createdAt: hoursBefore(-1, readAt) },
    ]);

    expect(await deleteLogs({ ...NONE, range: "24h" }, readAt)).toBe(1);
    expect(await remaining()).toEqual(["test.after_moment", "test.before_range"]);
  });
});
