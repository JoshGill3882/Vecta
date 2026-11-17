import "server-only";

import { logger } from "@/src/server/logger";
import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";

// Turns log entries into a downloadable file, as CSV for a spreadsheet or JSON
// for full detail. The entries arrive in batches and each batch is written as
// it arrives, so an export of any size is never held in memory whole.

/** The formats an export can be downloaded in. */
export const EXPORT_FORMATS = ["csv", "json"] as const;

/** One of the formats an export can be downloaded in. */
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** An entry as an export writes it, with its fields in column order. */
export interface ExportedEntry {
  /** When it was written, as an ISO 8601 timestamp in UTC. */
  time: string;
  /** Whether it records something on the server or something the user did. */
  kind: string;
  /** How severe it is. */
  level: string;
  /** Its stable machine-readable name. */
  event: string;
  /** Its human-readable line. */
  message: string;
  /** Its context, or null when it has none. */
  detail: Record<string, unknown> | null;
}

/** The CSV's header row: the fields of `ExportedEntry`, in the order `csvRow` writes them. */
const CSV_COLUMNS = ["time", "kind", "level", "event", "message", "detail"] as const;

/** Marks a CSV as UTF-8.
 *
 * Excel reads a CSV without it in the computer's legacy encoding, which
 * garbles any character outside ASCII, such as an accent in a task's title.
 */
const BYTE_ORDER_MARK = "\uFEFF";

/** The characters that start a formula when a spreadsheet reads them first in a cell.
 *
 * Tab and carriage return are included with the four formula signs, as
 * OWASP's guidance on CSV injection advises.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/** The characters that make a CSV cell need quoting. */
const NEEDS_QUOTES = /[",\r\n]/;

/** Picks out the fields an export writes, in column order.
 *
 * @param entry The entry as the log service reads it.
 * @returns The entry as an export writes it.
 */
function exported(entry: LogEntryDTO): ExportedEntry {
  return {
    time: entry.createdAt,
    kind: entry.kind,
    level: entry.level,
    event: entry.event,
    message: entry.message,
    detail: entry.detail,
  };
}

/** Writes one CSV cell, made safe for a spreadsheet to open.
 *
 * A cell that would start a formula gets an apostrophe in front, which a
 * spreadsheet reads as "this is text". Task titles are typed by the user, so
 * one could otherwise run as a formula on the computer that opens the file.
 * A cell holding a quote, a comma or a line break is quoted, with its quotes
 * doubled.
 *
 * @param value The cell's text.
 * @returns The cell as the CSV holds it.
 */
export function csvCell(value: string): string {
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Writes one entry as a CSV row, ending in the CRLF the CSV format specifies.
 *
 * @param entry The entry.
 * @returns The row, with the detail as JSON, or empty when there is none.
 */
function csvRow(entry: LogEntryDTO): string {
  const { time, kind, level, event, message, detail } = exported(entry);
  const cells = [time, kind, level, event, message, detail === null ? "" : JSON.stringify(detail)];
  return `${cells.map(csvCell).join(",")}\r\n`;
}

/** Writes an export's text in three parts: before the entries, each batch, and after them. */
interface ExportWriter {
  /** The text before the first entry. */
  start(): string;
  /** The text for one batch of entries. */
  batch(entries: LogEntryDTO[]): string;
  /** The text after the last entry. */
  end(): string;
}

/** Writes a CSV: the byte order mark and the header row, then a row per entry.
 *
 * @returns A writer for one export.
 */
function csvWriter(): ExportWriter {
  return {
    start: () => `${BYTE_ORDER_MARK}${CSV_COLUMNS.join(",")}\r\n`,
    batch: (entries) => entries.map(csvRow).join(""),
    end: () => "",
  };
}

/** Writes a JSON array with one entry to a line, so the file reads well as it is.
 *
 * Each entry after the first is preceded by a comma, so the writer counts
 * what it has written. An export with no entries is an empty array.
 *
 * @returns A writer for one export.
 */
function jsonWriter(): ExportWriter {
  let written = 0;
  return {
    start: () => "[",
    batch: (entries) =>
      entries
        .map((entry) => `${written++ === 0 ? "\n" : ",\n"}  ${JSON.stringify(exported(entry))}`)
        .join(""),
    end: () => (written === 0 ? "]\n" : "\n]\n"),
  };
}

/** Streams entries as an export file, a batch at a time.
 *
 * The next batch is read only when the reader is ready for more, so a slow
 * download never builds up entries in memory. A download that is stopped
 * stops the reading. A failure partway through is logged and ends the
 * download with an error, so the browser reports it failed rather than saving
 * a file that looks complete.
 *
 * @param format The file's format.
 * @param batches The entries to export, in the order they are written.
 * @returns The file's bytes, as a stream.
 */
export function exportStream(
  format: ExportFormat,
  batches: AsyncIterable<LogEntryDTO[]>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const writer = format === "csv" ? csvWriter() : jsonWriter();
  const reader = batches[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(writer.start()));
    },
    async pull(controller) {
      try {
        const next = await reader.next();
        if (next.done) {
          controller.enqueue(encoder.encode(writer.end()));
          controller.close();
        } else {
          controller.enqueue(encoder.encode(writer.batch(next.value)));
        }
      } catch (error) {
        logger.error("log.export_failed", "Could not finish a log export", { format, error });
        controller.error(error);
      }
    },
    async cancel() {
      await reader.return?.();
    },
  });
}

/** Names an export's file by when it was made, such as `vecta-logs-2026-11-17-0930.csv`.
 *
 * The date and time are the server's, as the Logs page shows them.
 *
 * @param format The file's format, which gives its extension.
 * @param now When the export was made.
 * @returns The file name.
 */
export function exportFileName(format: ExportFormat, now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `vecta-logs-${date}-${time}.${format}`;
}
