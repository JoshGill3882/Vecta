import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The real route and schemas run; the session and the log service behind them
// are stood in for, so no database is needed. stdout is captured to show a
// check logs nothing.

vi.mock("@/src/shared/lib/session", () => ({
  getSession: vi.fn(async () => ({ isLoggedIn: true })),
  getSessionFromRequest: vi.fn(),
}));

vi.mock("@/src/server/services/logs", () => ({
  countLogsSince: vi.fn(async () => 0),
  writeLog: vi.fn(async () => ({})),
}));

import { GET } from "@/app/api/logs/new/route";
import { config } from "@/proxy";
import { countLogsSince, writeLog } from "@/src/server/services/logs";
import { getSession } from "@/src/shared/lib/session";

const mockGetSession = vi.mocked(getSession);
const mockCountLogsSince = vi.mocked(countLogsSince);

/** When the page's counts were read, as the page sends it. */
const READ_AT = "2026-11-20T08:15:42.123Z";

let lines: string[];

/** Asks the route for a count with a query string.
 *
 * @param query The query string, without its `?`.
 * @returns The route's response.
 */
function checkWith(query: string): Promise<Response> {
  return GET(new NextRequest(`http://localhost/api/logs/new?${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ isLoggedIn: true } as never);
  mockCountLogsSince.mockResolvedValue(0);
  lines = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/logs/new", () => {
  it("refuses a signed-out request with a 401 and counts nothing", async () => {
    mockGetSession.mockResolvedValue(null as never);

    const res = await checkWith(`readAt=${READ_AT}`);

    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Sign in to check the log.");
    expect(mockCountLogsSince).not.toHaveBeenCalled();
  });

  it("answers with how many entries were written since the moment", async () => {
    mockCountLogsSince.mockResolvedValue(3);

    const res = await checkWith(`readAt=${READ_AT}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await res.json()).toEqual({ count: 3 });
  });

  it("counts from the moment the page sends, with no filters when none are on", async () => {
    await checkWith(`readAt=${READ_AT}`);

    expect(mockCountLogsSince).toHaveBeenCalledWith(
      { q: "", level: [], source: [], range: null, page: 1 },
      new Date(READ_AT)
    );
  });

  it("counts what the page's filters match, read as the page reads them", async () => {
    await checkWith(
      `q=milk&level=warn&level=error&source=auth&range=7d&readAt=${encodeURIComponent(READ_AT)}`
    );

    expect(mockCountLogsSince).toHaveBeenCalledWith(
      { q: "milk", level: ["warn", "error"], source: ["auth"], range: "7d", page: 1 },
      new Date(READ_AT)
    );
  });

  it("clears an unknown filter rather than refusing the check", async () => {
    await checkWith(`level=fatal&source=auth&range=1y&readAt=${READ_AT}`);

    expect(mockCountLogsSince).toHaveBeenCalledWith(
      expect.objectContaining({ level: [], source: ["auth"], range: null }),
      new Date(READ_AT)
    );
  });

  it.each([
    ["no moment", ""],
    ["an unreadable moment", "readAt=yesterday"],
    ["a date without a time", "readAt=2026-11-20"],
  ])("refuses %s with a 400 and counts nothing", async (_, query) => {
    const res = await checkWith(query);

    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Say when the page's counts were read, as readAt.");
    expect(mockCountLogsSince).not.toHaveBeenCalled();
  });

  it("keeps the answer out of every cache, so each check reaches the server", async () => {
    const res = await checkWith(`readAt=${READ_AT}`);

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sends a count only, never the entries", async () => {
    mockCountLogsSince.mockResolvedValue(2);

    const body = await (await checkWith(`readAt=${READ_AT}`)).json();

    expect(Object.keys(body)).toEqual(["count"]);
  });

  it("writes nothing to the log", async () => {
    await (await checkWith(`readAt=${READ_AT}`)).text();

    expect(lines).toEqual([]);
    expect(writeLog).not.toHaveBeenCalled();
  });
});

describe("/api/logs/new and the auth perimeter", () => {
  // Anchored as Next anchors it; see the health route's spec.
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it("is outside the proxy's matcher, so the route's own check is the only guard", () => {
    expect(matcher.test("/api/logs/new")).toBe(false);
  });
});
