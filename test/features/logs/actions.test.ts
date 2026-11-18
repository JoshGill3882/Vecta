import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConflictError } from "@/src/server/errors";

// The real validate() and the retention and purge schemas run, so the gate is
// the one the app uses; the session, the services behind each action,
// next/cache's refresh and the logger are stood in for.

vi.mock("@/src/shared/lib/session", () => ({
  getSession: vi.fn(async () => ({ isLoggedIn: true })),
}));

vi.mock("@/src/server/services/settings", () => ({
  setLogRetention: vi.fn(),
}));

vi.mock("@/src/server/log-retention", () => ({
  ageOutLogs: vi.fn(async () => 0),
}));

vi.mock("@/src/server/log-purge", () => ({
  purgeLogs: vi.fn(async () => 0),
}));

vi.mock("next/cache", () => ({
  refresh: vi.fn(),
}));

vi.mock("@/src/server/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  purgeLogsAction,
  removeOldLogsAction,
  setLogRetentionAction,
} from "@/src/features/logs/actions";
import { purgeLogs } from "@/src/server/log-purge";
import { ageOutLogs } from "@/src/server/log-retention";
import { logger } from "@/src/server/logger";
import { setLogRetention } from "@/src/server/services/settings";
import { getSession } from "@/src/shared/lib/session";
import { refresh } from "next/cache";

const mockGetSession = vi.mocked(getSession);
const mockSetLogRetention = vi.mocked(setLogRetention);
const mockAgeOutLogs = vi.mocked(ageOutLogs);
const mockPurgeLogs = vi.mocked(purgeLogs);
const mockRefresh = vi.mocked(refresh);
const mockLogError = vi.mocked(logger.error);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ isLoggedIn: true } as never);
  mockSetLogRetention.mockResolvedValue({ logRetentionDays: 90, lastAgeOut: null });
  mockAgeOutLogs.mockResolvedValue(0);
  mockPurgeLogs.mockResolvedValue(0);
});

describe("setLogRetentionAction", () => {
  it("refuses when signed out, saving nothing", async () => {
    mockGetSession.mockResolvedValue(null);

    expect(await setLogRetentionAction(30)).toEqual({
      ok: false,
      error: "You must be signed in",
      code: "UNAUTHENTICATED",
    });
    expect(mockSetLogRetention).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it.each([7, 30, 90, 365, 0])("saves %i and refreshes the page", async (days) => {
    expect(await setLogRetentionAction(days)).toEqual({ ok: true, data: days });
    expect(mockSetLogRetention).toHaveBeenCalledExactlyOnceWith(days);
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it.each([
    ["a number of days not offered", 14],
    ["a negative number", -7],
    ["a fraction", 7.5],
    ["a number sent as text", "30"],
    ["empty text, which would otherwise read as forever", ""],
    ["nothing", undefined],
    ["null", null],
    ["NaN", Number.NaN],
  ])("refuses %s, saving nothing", async (_, days) => {
    expect(await setLogRetentionAction(days)).toEqual({ ok: false, error: "Invalid input" });
    expect(mockSetLogRetention).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("passes a deliberate failure's own message on", async () => {
    mockSetLogRetention.mockRejectedValue(new ConflictError("Settings are being changed"));

    expect(await setLogRetentionAction(30)).toEqual({
      ok: false,
      error: "Settings are being changed",
      code: "CONFLICT",
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("hides an unexpected failure behind a generic message, and logs it", async () => {
    const error = new Error("database is locked");
    mockSetLogRetention.mockRejectedValue(error);

    expect(await setLogRetentionAction(30)).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
    });
    expect(mockLogError).toHaveBeenCalledWith("action.unexpected_error", expect.any(String), {
      error,
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("removeOldLogsAction", () => {
  it("refuses when signed out, removing nothing", async () => {
    mockGetSession.mockResolvedValue(null);

    expect(await removeOldLogsAction()).toEqual({
      ok: false,
      error: "You must be signed in",
      code: "UNAUTHENTICATED",
    });
    expect(mockAgeOutLogs).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("ages old entries out, returns how many went, and refreshes the page", async () => {
    mockAgeOutLogs.mockResolvedValue(12);

    expect(await removeOldLogsAction()).toEqual({ ok: true, data: 12 });
    expect(mockAgeOutLogs).toHaveBeenCalledOnce();
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("ages out from the moment it is called, as the nightly run does", async () => {
    await removeOldLogsAction();

    expect(mockAgeOutLogs).toHaveBeenCalledWith();
  });

  it("hides a failure behind a generic message, and logs it", async () => {
    const error = new Error("disk I/O error");
    mockAgeOutLogs.mockRejectedValue(error);

    expect(await removeOldLogsAction()).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
    });
    expect(mockLogError).toHaveBeenCalledWith("action.unexpected_error", expect.any(String), {
      error,
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("purgeLogsAction", () => {
  const READ_AT = "2026-11-17T19:30:00.000Z";
  const FILTERED = { scope: "filtered", level: ["warn"], source: ["auth"], readAt: READ_AT };

  it("refuses when signed out, deleting nothing", async () => {
    mockGetSession.mockResolvedValue(null);

    expect(await purgeLogsAction({ scope: "all", readAt: READ_AT })).toEqual({
      ok: false,
      error: "You must be signed in",
      code: "UNAUTHENTICATED",
    });
    expect(mockPurgeLogs).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("purges every entry counted, returns how many went, and refreshes the page", async () => {
    mockPurgeLogs.mockResolvedValue(1204);

    expect(await purgeLogsAction({ scope: "all", readAt: READ_AT })).toEqual({
      ok: true,
      data: 1204,
    });
    expect(mockPurgeLogs).toHaveBeenCalledExactlyOnceWith({
      scope: "all",
      readAt: new Date(READ_AT),
    });
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("purges the entries the filters match, passing them on as given", async () => {
    mockPurgeLogs.mockResolvedValue(6);

    expect(await purgeLogsAction(FILTERED)).toEqual({ ok: true, data: 6 });
    expect(mockPurgeLogs).toHaveBeenCalledExactlyOnceWith({
      ...FILTERED,
      readAt: new Date(READ_AT),
    });
  });

  it.each([
    ["a filtered purge with no filter on", { ...FILTERED, level: [], source: [] }],
    ["an unknown level, rather than clearing it", { ...FILTERED, level: ["fatal"] }],
    ["an unknown scope", { scope: "older", readAt: READ_AT }],
    ["no moment", { scope: "all" }],
    ["nothing", undefined],
    ["null", null],
  ])("refuses %s, deleting nothing", async (_, purge) => {
    expect(await purgeLogsAction(purge)).toEqual({ ok: false, error: "Invalid input" });
    expect(mockPurgeLogs).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("hides a failure behind a generic message, and logs it", async () => {
    const error = new Error("database is locked");
    mockPurgeLogs.mockRejectedValue(error);

    expect(await purgeLogsAction({ scope: "all", readAt: READ_AT })).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
    });
    expect(mockLogError).toHaveBeenCalledWith("action.unexpected_error", expect.any(String), {
      error,
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
