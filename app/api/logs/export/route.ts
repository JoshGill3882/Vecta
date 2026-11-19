import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  EXPORT_FORMATS,
  exportFileName,
  exportStream,
  type ExportFormat,
} from "@/src/server/log-export";
import { readLogBatches } from "@/src/server/services/logs";
import { logFiltersSchema, logReadAtSchema } from "@/src/shared/lib/schemas/logs";
import { getSession } from "@/src/shared/lib/session";

/** The media type each format is served as. */
const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
};

/** Reads the format from the query string, refusing anything but the two formats. */
const formatSchema = z.enum(EXPORT_FORMATS);

/** Downloads the log entries the Logs page's filters match, as CSV or JSON.
 *
 * Called as `/api/logs/export?format=csv`, with the page's `q`, `level`,
 * `source` and `range` parameters. The filters are read as the page reads
 * them, so an unknown level, source or range clears that filter rather than
 * refusing the export.
 *
 * With `readAt`, as the Purge confirmation sends it, only entries written up
 * to then are exported, so the file holds what the purge would delete. An
 * unreadable one is ignored as an unknown filter is, and every match is
 * exported.
 *
 * The proxy leaves `/api` routes alone, so the session is checked here: an
 * export can hold the history of everything the user has done. The entries
 * are streamed as they are read, and the download writes nothing to the log,
 * as reading the Logs page does not.
 *
 * @param request The request, whose query string holds the format and filters.
 * @returns The file, a 401 when nobody is signed in, or a 400 for an unknown format.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!(await getSession())) {
    return new Response("Sign in to export the log.", { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const format = formatSchema.safeParse(params.get("format"));
  if (!format.success) {
    return new Response("Choose a format: csv or json.", { status: 400 });
  }

  const filters = logFiltersSchema.parse({
    q: params.getAll("q"),
    level: params.getAll("level"),
    source: params.getAll("source"),
    range: params.getAll("range"),
  });
  const readAt = logReadAtSchema.safeParse(params.get("readAt"));
  const batches = readLogBatches({ ...filters, readAt: readAt.data });

  return new Response(exportStream(format.data, batches), {
    headers: {
      "Content-Type": CONTENT_TYPES[format.data],
      "Content-Disposition": `attachment; filename="${exportFileName(format.data, new Date())}"`,
      // The log is private, so no browser or proxy keeps a copy.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
