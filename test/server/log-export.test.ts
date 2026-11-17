import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real logger runs, so a failed export's entry can be read from stdout; its
// table write is stood in for, since no database is open here.
vi.mock("@/src/server/services/logs", () => ({ writeLog: vi.fn(async () => ({})) }));

import { csvCell, exportFileName, exportStream } from "@/src/server/log-export";
import { flushLogs } from "@/src/server/logger";
import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";

const originalTZ = process.env.TZ;
let lines: string[];

/** Builds an entry, a plain activity one unless a test says otherwise.
 *
 * @param change The fields that differ.
 * @returns The entry.
 */
function entry(change: Partial<LogEntryDTO> = {}): LogEntryDTO {
  return {
    id: "e1",
    createdAt: "2026-11-14T09:00:00.000Z",
    kind: "activity",
    level: "info",
    event: "task.deleted",
    source: "tasks",
    message: "Deleted a task",
    detail: null,
    ...change,
  };
}

/** Hands over batches the way the log service does, one at a time.
 *
 * @param batches The batches, in order.
 * @yields Each batch.
 */
async function* batchesOf(...batches: LogEntryDTO[][]): AsyncGenerator<LogEntryDTO[]> {
  for (const batch of batches) yield batch;
}

/** Reads a whole stream as text, keeping a byte order mark if it has one.
 *
 * @param stream The export's bytes.
 * @returns The text.
 */
async function text(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  const reader = stream.getReader();
  let result = "";
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    result += decoder.decode(next.value, { stream: true });
  }
  return result + decoder.decode();
}

/** Every JSON line written to stdout since the test began.
 *
 * @returns The lines, parsed.
 */
function stdout(): Record<string, unknown>[] {
  return lines.map((line) => JSON.parse(line));
}

beforeEach(() => {
  lines = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
});

afterEach(async () => {
  await flushLogs();
  vi.restoreAllMocks();
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const HEADER = "\uFEFFtime,kind,level,event,message,detail\r\n";

describe("csvCell", () => {
  it.each([
    ["plain text as it is", "Deleted a task", "Deleted a task"],
    ["an empty cell as empty", "", ""],
    ["a comma inside quotes", "Renew, then file", '"Renew, then file"'],
    ["quotes doubled inside quotes", 'Renew "the" passport', '"Renew ""the"" passport"'],
    ["a line break inside quotes", "Line one\nline two", '"Line one\nline two"'],
    ["a carriage return behind an apostrophe, in quotes", "\rText", '"\'\rText"'],
    ["a formula sign later in the text as it is", "Total = 4", "Total = 4"],
  ])("writes %s", (_, value, cell) => {
    expect(csvCell(value)).toBe(cell);
  });

  it.each(["=", "+", "-", "@", "\t"])("puts an apostrophe before a cell starting %j", (sign) => {
    expect(csvCell(`${sign}SUM(A1:A9)`)).toBe(`'${sign}SUM(A1:A9)`);
  });

  it("quotes a formula that also needs quoting, apostrophe inside the quotes", () => {
    expect(csvCell('=HYPERLINK("http://x.test","Open")')).toBe(
      '"\'=HYPERLINK(""http://x.test"",""Open"")"'
    );
  });
});

describe("exportStream as CSV", () => {
  it("writes the byte order mark and the header row when there are no entries", async () => {
    expect(await text(exportStream("csv", batchesOf()))).toBe(HEADER);
  });

  it("writes a row per entry, with the detail as one JSON cell", async () => {
    const csv = await text(
      exportStream("csv", batchesOf([entry({ detail: { id: "t1", title: "Renew" } })]))
    );

    expect(csv).toBe(
      `${HEADER}2026-11-14T09:00:00.000Z,activity,info,task.deleted,Deleted a task,"{""id"":""t1"",""title"":""Renew""}"\r\n`
    );
  });

  it("leaves the detail cell empty for an entry with none", async () => {
    const csv = await text(
      exportStream("csv", batchesOf([entry({ kind: "operational", event: "server.started" })]))
    );

    expect(csv.split("\r\n")[1]).toBe(
      "2026-11-14T09:00:00.000Z,operational,info,server.started,Deleted a task,"
    );
  });

  it("makes a formula typed into a task's title safe in the message", async () => {
    const csv = await text(
      exportStream("csv", batchesOf([entry({ message: "=cmd|' /C calc'!A0" })]))
    );

    expect(csv.split("\r\n")[1]).toContain(",'=cmd|' /C calc'!A0,");
  });

  it("writes every batch's rows, in the order they came", async () => {
    const csv = await text(
      exportStream(
        "csv",
        batchesOf(
          [entry({ id: "a", message: "A" }), entry({ id: "b", message: "B" })],
          [entry({ id: "c", message: "C" })]
        )
      )
    );

    const messages = csv
      .split("\r\n")
      .slice(1, -1)
      .map((row) => row.split(",")[4]);
    expect(messages).toEqual(["A", "B", "C"]);
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("exportStream as JSON", () => {
  it("writes an empty array when there are no entries", async () => {
    const json = await text(exportStream("json", batchesOf()));

    expect(json).toBe("[]\n");
    expect(JSON.parse(json)).toEqual([]);
  });

  it("writes an array of entries with the same six fields and the detail as an object", async () => {
    const json = await text(
      exportStream(
        "json",
        batchesOf([entry({ detail: { id: "t1", changed: ["title"] } })], [entry({ level: "warn" })])
      )
    );

    expect(JSON.parse(json)).toEqual([
      {
        time: "2026-11-14T09:00:00.000Z",
        kind: "activity",
        level: "info",
        event: "task.deleted",
        message: "Deleted a task",
        detail: { id: "t1", changed: ["title"] },
      },
      {
        time: "2026-11-14T09:00:00.000Z",
        kind: "activity",
        level: "warn",
        event: "task.deleted",
        message: "Deleted a task",
        detail: null,
      },
    ]);
  });

  it("writes one entry to a line, across batches", async () => {
    const json = await text(
      exportStream(
        "json",
        batchesOf([entry({ id: "a" }), entry({ id: "b" })], [entry({ id: "c" })])
      )
    );

    const rows = json.trimEnd().split("\n");
    expect(rows[0]).toBe("[");
    expect(rows.at(-1)).toBe("]");
    expect(rows.slice(1, -1)).toHaveLength(3);
    expect(rows.slice(1, -2).every((line) => line.endsWith(","))).toBe(true);
  });
});

describe("exportStream while it runs", () => {
  it("reads a batch only when the download is ready for more", async () => {
    let asked = 0;
    /** Hands over five batches, counting each one asked for. */
    async function* counted(): AsyncGenerator<LogEntryDTO[]> {
      for (let i = 0; i < 5; i++) {
        asked++;
        yield [entry()];
      }
    }

    const reader = exportStream("json", counted()).getReader();
    await reader.read();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(asked).toBeLessThan(5);
    await reader.cancel();
  });

  it("stops reading the log when the download is stopped", async () => {
    let finished = false;
    let asked = 0;
    /** Hands over batches for ever, noting when it is stopped. */
    async function* endless(): AsyncGenerator<LogEntryDTO[]> {
      try {
        while (true) {
          asked++;
          yield [entry()];
        }
      } finally {
        finished = true;
      }
    }

    const reader = exportStream("csv", endless()).getReader();
    await reader.read();
    await reader.read();
    await reader.cancel();
    const askedAtCancel = asked;
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(finished).toBe(true);
    expect(asked).toBe(askedAtCancel);
  });

  it("ends the download with the error and logs it when reading fails partway", async () => {
    const failure = new Error("database is gone");
    /** Hands over one batch, then fails as a lost database would. */
    async function* failing(): AsyncGenerator<LogEntryDTO[]> {
      yield [entry()];
      throw failure;
    }

    await expect(text(exportStream("csv", failing()))).rejects.toBe(failure);

    const [line] = stdout().filter((l) => l.event === "log.export_failed");
    expect(line).toMatchObject({
      kind: "operational",
      level: "error",
      message: "Could not finish a log export",
      detail: { format: "csv", error: expect.objectContaining({ message: "database is gone" }) },
    });
  });

  it("logs nothing when an export finishes", async () => {
    await text(exportStream("json", batchesOf([entry()])));

    expect(lines).toEqual([]);
  });
});

describe("exportFileName", () => {
  it("names the file by the date and time, with the format's extension", () => {
    process.env.TZ = "UTC";

    expect(exportFileName("csv", new Date("2026-01-05T09:05:30.000Z"))).toBe(
      "vecta-logs-2026-01-05-0905.csv"
    );
    expect(exportFileName("json", new Date("2026-11-17T19:30:00.000Z"))).toBe(
      "vecta-logs-2026-11-17-1930.json"
    );
  });

  it("uses the server's time zone, even when that changes the date", () => {
    process.env.TZ = "Europe/London";

    expect(exportFileName("csv", new Date("2026-07-01T23:45:00.000Z"))).toBe(
      "vecta-logs-2026-07-02-0045.csv"
    );
  });
});
