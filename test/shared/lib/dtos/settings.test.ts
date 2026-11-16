import { describe, it, expect } from "vitest";
import type { SettingsModel } from "@/generated/prisma-sqlite/models";
import { toSettingsDTO } from "@/src/shared/lib/dtos/settings";

const ROW: SettingsModel = {
  id: 1,
  logRetentionDays: 30,
  logAgeOutRanAt: new Date("2026-11-16T03:00:00.000Z"),
  logAgeOutRemoved: 12,
};

describe("toSettingsDTO", () => {
  it("maps every setting, with the last run's time as an ISO string", () => {
    expect(toSettingsDTO(ROW)).toEqual({
      logRetentionDays: 30,
      lastAgeOut: { ranAt: "2026-11-16T03:00:00.000Z", removed: 12 },
    });
  });

  it("reads the defaults when no settings have been saved", () => {
    expect(toSettingsDTO(null)).toEqual({ logRetentionDays: 90, lastAgeOut: null });
  });

  it("keeps forever as forever, not as the default", () => {
    expect(toSettingsDTO({ ...ROW, logRetentionDays: 0 }).logRetentionDays).toBe(0);
  });

  it.each([14, -1, 100000])(
    "reads a stored retention of %i, which is not a choice, as the default",
    (days) => {
      expect(toSettingsDTO({ ...ROW, logRetentionDays: days }).logRetentionDays).toBe(90);
    }
  );

  it("keeps a run that removed nothing", () => {
    expect(toSettingsDTO({ ...ROW, logAgeOutRemoved: 0 }).lastAgeOut).toEqual({
      ranAt: "2026-11-16T03:00:00.000Z",
      removed: 0,
    });
  });

  it("has no last run until one has been recorded", () => {
    expect(
      toSettingsDTO({ ...ROW, logAgeOutRanAt: null, logAgeOutRemoved: null }).lastAgeOut
    ).toBeNull();
  });

  it("has no last run when only half of one is stored", () => {
    expect(toSettingsDTO({ ...ROW, logAgeOutRemoved: null }).lastAgeOut).toBeNull();
    expect(toSettingsDTO({ ...ROW, logAgeOutRanAt: null }).lastAgeOut).toBeNull();
  });
});
