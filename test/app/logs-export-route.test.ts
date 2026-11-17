import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The real route, schema and export stream run; the session and the log
// service behind them are stood in for, so no database is needed. stdout is
// captured to show an export logs nothing.

vi.mock("@/src/shared/lib/session", () => ({
  getSession: vi.fn(async () => ({ isLoggedIn: true })),
  getSessionFromRequest: vi.fn(),
}));

vi.mock("@/src/server/services/logs", () => ({
  readLogBatches: vi.fn(),
  writeLog: vi.fn(async () => ({})),
}));

import { GET } from "@/app/api/logs/export/route";
import { config } from "@/proxy";
import { readLogBatches, writeLog } from "@/src/server/services/logs";
import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { getSession } from "@/src/shared/lib/session";

const mockGetSession = vi.mocked(getSession);
const mockReadLogBatches = vi.mocked(readLogBatches);

const ENTRY: LogEntryDTO = {
  id: "e1",
  createdAt: "2026-11-14T09:00:00.000Z",
  kind: "activity",
  level: "warn",
  event: "auth.sign_in_failed",
  source: "auth",
  message: "A sign-in failed",
  detail: { ip: "192.0.2.1" },
};

const originalTZ = process.env.TZ;
let lines: string[];

/** Hands over one batch holding the test entry, as the log service would.
 *
 * @yields The batch.
 */
async function* oneBatch(): AsyncGenerator<LogEntryDTO[]> {
  yield [ENTRY];
}

/** Requests an export with a query string.
 *
 * @param query The query string, without its `?`.
 * @returns The route's response.
 */
function exportWith(query: string): Promise<Response> {
  return GET(new NextRequest(`http://localhost/api/logs/export?${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ isLoggedIn: true } as never);
  mockReadLogBatches.mockImplementation(oneBatch);
  process.env.TZ = "UTC";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T19:30:00.000Z"));
  lines = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe("GET /api/logs/export", () => {
  it("refuses a signed-out request with a 401 and reads no entries", async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await exportWith("format=json");

    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain(ENTRY.message);
    expect(mockReadLogBatches).not.toHaveBeenCalled();
  });

  it.each([
    ["no format", ""],
    ["an unknown format", "format=xml"],
    ["a format in capitals", "format=CSV"],
  ])("refuses %s with a 400 and reads no entries", async (_, query) => {
    const res = await exportWith(query);

    expect(res.status).toBe(400);
    expect(mockReadLogBatches).not.toHaveBeenCalled();
  });

  it("downloads a CSV named by the date and time", async () => {
    const res = await exportWith("format=csv");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="vecta-logs-2026-11-17-1930.csv"'
    );
    expect((await res.text()).split("\r\n")[1]).toBe(
      '2026-11-14T09:00:00.000Z,activity,warn,auth.sign_in_failed,A sign-in failed,"{""ip"":""192.0.2.1""}"'
    );
  });

  it("downloads JSON named by the date and time", async () => {
    const res = await exportWith("format=json");

    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="vecta-logs-2026-11-17-1930.json"'
    );
    expect(await res.json()).toEqual([
      {
        time: ENTRY.createdAt,
        kind: ENTRY.kind,
        level: ENTRY.level,
        event: ENTRY.event,
        message: ENTRY.message,
        detail: ENTRY.detail,
      },
    ]);
  });

  it("keeps the download out of every cache and stops the browser guessing its type", async () => {
    const res = await exportWith("format=csv");

    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("exports every entry when no filter is on", async () => {
    await exportWith("format=csv");

    expect(mockReadLogBatches).toHaveBeenCalledWith(
      expect.objectContaining({ level: [], source: [] })
    );
  });

  it("exports what the page's filters match, given once or repeated", async () => {
    await exportWith("format=json&level=warn&level=error&source=auth&page=3");

    expect(mockReadLogBatches).toHaveBeenCalledWith(
      expect.objectContaining({ level: ["warn", "error"], source: ["auth"] })
    );
  });

  it("clears a filter holding an unknown choice, as the page does", async () => {
    await exportWith("format=csv&level=fatal&source=auth");

    expect(mockReadLogBatches).toHaveBeenCalledWith(
      expect.objectContaining({ level: [], source: ["auth"] })
    );
  });

  it("writes nothing to the log", async () => {
    const res = await exportWith("format=csv");
    await res.text();

    expect(lines).toEqual([]);
    expect(writeLog).not.toHaveBeenCalled();
  });
});

describe("/api/logs/export and the auth perimeter", () => {
  // Anchored as Next anchors it; see the health route's spec.
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it("is outside the proxy's matcher, so the route's own check is the only guard", () => {
    expect(matcher.test("/api/logs/export")).toBe(false);
  });
});
