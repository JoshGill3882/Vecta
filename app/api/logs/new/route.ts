import type { NextRequest } from "next/server";

import { countLogsSince } from "@/src/server/services/logs";
import { logFiltersFromParams, logReadAtSchema } from "@/src/shared/lib/schemas/logs";
import { getSession } from "@/src/shared/lib/session";

/** Counts the log entries written since the Logs page read its counts that match its filters.
 *
 * Called as `/api/logs/new?readAt=…`, with the page's `q`, `level`, `source`
 * and `range` parameters, and answered as `{ "count": 3 }`. The filters are
 * read as the page reads them, so an unknown one is cleared rather than
 * refused. `readAt` is the moment the page's counts were read; without one
 * there is nothing to count from, so the request is refused.
 *
 * The proxy leaves `/api` routes alone, so the session is checked here. Only
 * a count is sent back, never the entries, and the check writes nothing to
 * the log, so a page left open asking every few seconds never fills the log
 * with its own checks.
 *
 * @param request The request, whose query string holds the moment and the filters.
 * @returns The count, a 401 when nobody is signed in, or a 400 for a missing or unreadable moment.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!(await getSession())) {
    return new Response("Sign in to check the log.", { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const readAt = logReadAtSchema.safeParse(params.get("readAt"));
  if (!readAt.success) {
    return new Response("Say when the page's counts were read, as readAt.", { status: 400 });
  }

  const count = await countLogsSince(logFiltersFromParams(params), readAt.data);
  // Each check must reach the server, so no browser or proxy answers it from a copy.
  return Response.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
