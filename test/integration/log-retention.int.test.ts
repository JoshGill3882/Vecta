import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/src/server/db";
import { ageOutLogs, retentionCutoff } from "@/src/server/log-retention";
import { flushLogs } from "@/src/server/logger";
import { deleteLogsBefore } from "@/src/server/services/logs";
import { getSettings, setLogRetention } from "@/src/server/services/settings";

const NOW = new Date("2026-11-16T03:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

/** Inserts one entry per age, each named by how old it is.
 *
 * @param ages How long before `NOW` each entry was written, in milliseconds.
 * @returns Nothing; the rows are in the table.
 */
async function seedAged(ages: number[]): Promise<void> {
  await prisma.log.createMany({
    data: ages.map((age) => ({
      kind: "operational",
      level: "info",
      event: "test.aged",
      message: `Written ${age} ms before now`,
      createdAt: new Date(NOW.getTime() - age),
    })),
  });
}

/** Lists what is left in the table, so a test can see which entries survived.
 *
 * @returns The remaining entries' messages, oldest first.
 */
async function survivors(): Promise<string[]> {
  const rows = await prisma.log.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((row) => row.message);
}

describe("retentionCutoff", () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it("has no cut-off when entries are kept forever", () => {
    expect(retentionCutoff(0, NOW)).toBeNull();
  });

  it.each([7, 30, 90, 365] as const)("counts back %i days", (days) => {
    process.env.TZ = "UTC";
    expect(retentionCutoff(days, NOW)?.getTime()).toBe(NOW.getTime() - days * DAY);
  });

  it("keeps the time of day across a clock change", () => {
    // London's clocks went back an hour on 25 October 2026, so 30 days before
    // 03:00 GMT is 03:00 BST, which is 23 hours more than 30 spans of 24.
    process.env.TZ = "Europe/London";
    const cutoff = retentionCutoff(30, NOW);

    expect(cutoff?.toISOString()).toBe("2026-10-17T02:00:00.000Z");
    expect(cutoff?.getHours()).toBe(3);
  });

  it("leaves the moment it counts from as it was", () => {
    const now = new Date(NOW);
    retentionCutoff(7, now);
    expect(now).toEqual(NOW);
  });
});

describe("deleteLogsBefore (integration)", () => {
  it("deletes the entries written before the cut-off, keeping one written at it", async () => {
    await seedAged([3 * DAY, 2 * DAY, DAY, 0]);

    expect(await deleteLogsBefore(new Date(NOW.getTime() - 2 * DAY))).toBe(1);
    expect(await survivors()).toEqual([
      `Written ${2 * DAY} ms before now`,
      `Written ${DAY} ms before now`,
      "Written 0 ms before now",
    ]);
  });

  it("deletes nothing more when run again", async () => {
    await seedAged([3 * DAY, 0]);
    const cutoff = new Date(NOW.getTime() - DAY);

    expect(await deleteLogsBefore(cutoff)).toBe(1);
    expect(await deleteLogsBefore(cutoff)).toBe(0);
    expect(await prisma.log.count()).toBe(1);
  });
});

describe("ageOutLogs (integration)", () => {
  // UTC, so a day is always 24 hours and the ages below are exact.
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it("removes what is older than the default of 90 days, before any is chosen", async () => {
    process.env.TZ = "UTC";
    await seedAged([100 * DAY, 90 * DAY + 1, 90 * DAY, 89 * DAY, DAY]);

    expect(await ageOutLogs(NOW)).toBe(2);
    expect(await prisma.log.count()).toBe(3);
  });

  it("removes what is older than the chosen retention", async () => {
    process.env.TZ = "UTC";
    await setLogRetention(7);
    await seedAged([30 * DAY, 8 * DAY, 6 * DAY]);

    expect(await ageOutLogs(NOW)).toBe(2);
    expect(await survivors()).toEqual([`Written ${6 * DAY} ms before now`]);
  });

  it("removes nothing when entries are kept forever", async () => {
    await setLogRetention(0);
    await seedAged([3000 * DAY, 400 * DAY]);

    expect(await ageOutLogs(NOW)).toBe(0);
    expect(await prisma.log.count()).toBe(2);
  });

  it("records when it ran and how many it removed", async () => {
    process.env.TZ = "UTC";
    await seedAged([100 * DAY, 95 * DAY, DAY]);

    await ageOutLogs(NOW);

    expect((await getSettings()).lastAgeOut).toEqual({
      ranAt: "2026-11-16T03:00:00.000Z",
      removed: 2,
    });
  });

  it("records a run that removed nothing, forever included", async () => {
    await setLogRetention(0);

    await ageOutLogs(NOW);

    expect((await getSettings()).lastAgeOut).toEqual({
      ranAt: "2026-11-16T03:00:00.000Z",
      removed: 0,
    });
  });

  it("leaves the chosen retention as it was", async () => {
    await setLogRetention(30);

    await ageOutLogs(NOW);

    expect((await getSettings()).logRetentionDays).toBe(30);
  });

  it("writes no log entry of its own", async () => {
    process.env.TZ = "UTC";
    await seedAged([100 * DAY, DAY]);

    await ageOutLogs(NOW);
    await flushLogs();

    expect(await prisma.log.findMany({ select: { event: true } })).toEqual([
      { event: "test.aged" },
    ]);
  });

  it("removes nothing more when run again", async () => {
    process.env.TZ = "UTC";
    await seedAged([100 * DAY, DAY]);

    expect(await ageOutLogs(NOW)).toBe(1);
    expect(await ageOutLogs(NOW)).toBe(0);
  });

  it("counts back from the moment it runs when given none", async () => {
    await prisma.log.createMany({
      data: [
        {
          kind: "operational",
          level: "info",
          event: "test.aged",
          message: "old",
          createdAt: new Date(Date.now() - 100 * DAY),
        },
        {
          kind: "operational",
          level: "info",
          event: "test.aged",
          message: "new",
          createdAt: new Date(),
        },
      ],
    });

    expect(await ageOutLogs()).toBe(1);
    const ranAt = Date.parse((await getSettings()).lastAgeOut?.ranAt ?? "");
    expect(Date.now() - ranAt).toBeLessThan(60_000);
  });
});
