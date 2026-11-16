import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { prisma } from "@/src/server/db";
import { getSettings, recordAgeOut, setLogRetention } from "@/src/server/services/settings";
import type { LogRetentionDays } from "@/src/shared/lib/dtos/settings";
import { LOG_RETENTION_DAYS } from "@/src/shared/lib/schemas/settings";

const RAN_AT = new Date("2026-11-16T03:00:00.000Z");

describe("getSettings (integration)", () => {
  it("reads the defaults, and saves nothing, when the table is empty", async () => {
    expect(await getSettings()).toEqual({ logRetentionDays: 90, lastAgeOut: null });
    expect(await prisma.settings.count()).toBe(0);
  });

  it("reads a stored retention that is not a choice as the default", async () => {
    await prisma.settings.create({ data: { id: 1, logRetentionDays: 14 } });

    expect((await getSettings()).logRetentionDays).toBe(90);
  });
});

describe("setLogRetention (integration)", () => {
  it.each([...LOG_RETENTION_DAYS])("saves %i and reads it back", async (days) => {
    expect((await setLogRetention(days)).logRetentionDays).toBe(days);
    expect((await getSettings()).logRetentionDays).toBe(days);
  });

  it("changes the one row rather than adding another", async () => {
    await setLogRetention(7);
    await setLogRetention(365);

    expect(await prisma.settings.findMany()).toEqual([
      expect.objectContaining({ id: 1, logRetentionDays: 365 }),
    ]);
  });

  it("refuses a length that is not a choice, saving nothing", async () => {
    // Cast: callers are typed to the choices, but a value from a request is not.
    await expect(setLogRetention(14 as number as LogRetentionDays)).rejects.toBeInstanceOf(
      ZodError
    );
    expect(await prisma.settings.count()).toBe(0);
  });

  it("keeps the last run", async () => {
    await recordAgeOut(RAN_AT, 12);
    await setLogRetention(30);

    expect((await getSettings()).lastAgeOut).toEqual({
      ranAt: "2026-11-16T03:00:00.000Z",
      removed: 12,
    });
  });
});

describe("recordAgeOut (integration)", () => {
  it("stores when the run happened and what it removed", async () => {
    await recordAgeOut(RAN_AT, 12);

    expect((await getSettings()).lastAgeOut).toEqual({
      ranAt: "2026-11-16T03:00:00.000Z",
      removed: 12,
    });
  });

  // The table's own default must agree with the code's, since a first run
  // creates the row without choosing a retention.
  it("leaves the retention at the default when it creates the row", async () => {
    await recordAgeOut(RAN_AT, 0);

    expect((await getSettings()).logRetentionDays).toBe(90);
  });

  it("keeps the chosen retention", async () => {
    await setLogRetention(7);
    await recordAgeOut(RAN_AT, 3);

    expect((await getSettings()).logRetentionDays).toBe(7);
  });

  it("replaces the previous run", async () => {
    await recordAgeOut(RAN_AT, 12);
    await recordAgeOut(new Date("2026-11-17T03:00:00.000Z"), 0);

    expect((await getSettings()).lastAgeOut).toEqual({
      ranAt: "2026-11-17T03:00:00.000Z",
      removed: 0,
    });
  });
});
