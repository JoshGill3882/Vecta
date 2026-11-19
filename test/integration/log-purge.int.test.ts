import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/server/db";
import { purgeLogs } from "@/src/server/log-purge";
import { listLogs } from "@/src/server/services/logs";
import { NO_FILTERS } from "@/src/shared/lib/schemas/logs";

/** The moment the confirmation's counts were read, between the seeded entries. */
const READ_AT = new Date("2026-11-14T09:00:02.000Z");

let lines: Record<string, unknown>[];

/** Inserts one entry per event, one second apart, oldest first.
 *
 * @param rows The event and level of each entry, and its detail as stored, if any.
 * @returns Nothing; the rows are in the table.
 */
async function seed(rows: { event: string; level: string; detail?: string }[]): Promise<void> {
  const start = Date.parse("2026-11-14T09:00:00.000Z");
  await prisma.log.createMany({
    data: rows.map((row, i) => ({
      kind: "operational",
      message: `Entry ${i}`,
      ...row,
      createdAt: new Date(start + i * 1000),
    })),
  });
}

/** Three entries the counts saw, and one written after they were read. */
const ENTRIES = [
  { event: "auth.sign_in_failed", level: "warn" },
  { event: "task.created", level: "info" },
  { event: "server.started", level: "info" },
  { event: "auth.signed_in", level: "info" },
];

beforeEach(() => {
  lines = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(JSON.parse(String(chunk)));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("purgeLogs (integration)", () => {
  it("deletes every entry counted, keeping one written since and the purge's own", async () => {
    await seed(ENTRIES);

    expect(await purgeLogs({ scope: "all", readAt: READ_AT })).toBe(3);

    expect((await listLogs()).map((e) => e.event)).toEqual(["log.purged", "auth.signed_in"]);
  });

  it("deletes only the counted entries the filters match", async () => {
    await seed(ENTRIES);

    const removed = await purgeLogs({
      scope: "filtered",
      ...NO_FILTERS,
      source: ["auth", "system"],
      readAt: READ_AT,
    });

    expect(removed).toBe(2);
    expect((await listLogs()).map((e) => e.event)).toEqual([
      "log.purged",
      "auth.signed_in",
      "task.created",
    ]);
  });

  it("deletes only the counted entries the search matches", async () => {
    await seed([
      { event: "task.deleted", level: "info", detail: '{"title":"Buy milk"}' },
      { event: "task.deleted", level: "info", detail: '{"title":"Post letters"}' },
      { event: "task.created", level: "info", detail: '{"title":"Milk the goat"}' },
      { event: "task.deleted", level: "info", detail: '{"title":"Buy more milk"}' },
    ]);

    const removed = await purgeLogs({
      scope: "filtered",
      ...NO_FILTERS,
      q: "MILK",
      readAt: READ_AT,
    });

    expect(removed).toBe(2);
    const left = await listLogs();
    expect(left.map((e) => e.detail?.title ?? e.event)).toEqual([
      "log.purged",
      "Buy more milk",
      "Post letters",
    ]);
  });

  it("records the purge as a warning, with its scope, the number removed and the filters", async () => {
    await seed(ENTRIES);

    await purgeLogs({
      scope: "filtered",
      q: "sign",
      level: ["warn"],
      source: ["auth"],
      range: null,
      readAt: READ_AT,
    });

    const [entry] = await listLogs();
    expect(entry).toMatchObject({
      kind: "activity",
      level: "warn",
      event: "log.purged",
      message: "Log entries purged",
      detail: {
        scope: "filtered",
        removed: 1,
        search: "sign",
        level: ["warn"],
        source: ["auth"],
        range: null,
      },
    });
  });

  it("records the range a purge reached back over", async () => {
    await seed(ENTRIES);

    await purgeLogs({ scope: "filtered", ...NO_FILTERS, range: "24h", readAt: READ_AT });

    const [entry] = await listLogs();
    expect(entry.detail).toMatchObject({ scope: "filtered", removed: 3, range: "24h" });
  });

  it("records a purge of every entry with no filters, whatever the page had on", async () => {
    await seed(ENTRIES);

    await purgeLogs({ scope: "all", readAt: READ_AT });

    const [entry] = await listLogs();
    expect(entry.detail).toEqual({
      scope: "all",
      removed: 3,
      search: "",
      level: [],
      source: [],
      range: null,
    });
  });

  it("has the record in the table by the time it returns", async () => {
    await purgeLogs({ scope: "all", readAt: READ_AT });

    // No flushLogs here: the purge waited for the write itself.
    expect(await prisma.log.count({ where: { event: "log.purged" } })).toBe(1);
  });

  it("records a purge that removed nothing", async () => {
    await purgeLogs({ scope: "all", readAt: READ_AT });

    const [entry] = await listLogs();
    expect(entry).toMatchObject({ event: "log.purged", detail: { removed: 0 } });
  });

  it("writes the record to stdout too, whatever the minimum level", async () => {
    vi.stubEnv("LOG_LEVEL", "error");
    await seed(ENTRIES);

    await purgeLogs({ scope: "all", readAt: READ_AT });

    expect(lines).toContainEqual(
      expect.objectContaining({ kind: "activity", level: "warn", event: "log.purged" })
    );
  });
});
