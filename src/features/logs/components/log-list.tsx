import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { groupByDay } from "@/src/features/logs/lib/log-format";
import { cn } from "@/src/shared/lib/utils";

import { LOG_COLUMNS, LogRow } from "./log-row";

/** A page of entries in a card, under a heading per day.
 *
 * Each day is a section named by its heading, so a screen reader can move
 * from day to day. The column header is drawn for sighted readers on a wide
 * screen only: each row's cells already say what they are. `now` is the
 * moment "today" is taken from, taken once by the caller, and `needle` is the
 * search each row marks in its message, already normalised.
 */
export function LogList({
  entries,
  now,
  needle,
}: {
  entries: LogEntryDTO[];
  now: Date;
  needle: string;
}) {
  return (
    <div className="bg-card overflow-hidden rounded-[13px] border">
      <div
        aria-hidden
        className={cn(
          "text-text-3 hidden h-9 items-center gap-x-3.5 border-b px-4 text-[11.5px] font-semibold tracking-[0.04em] uppercase min-[720px]:grid",
          LOG_COLUMNS
        )}
      >
        <span>Time</span>
        <span>Level</span>
        <span>Source</span>
        <span>Message</span>
      </div>

      {groupByDay(entries, now).map((day) => {
        const headingId = `log-day-${day.key}`;
        return (
          <section key={day.key} aria-labelledby={headingId}>
            <h2
              id={headingId}
              className="bg-surface-2 text-text-2 border-border-faint border-b px-4 py-[7px] text-xs font-semibold"
            >
              {day.label}
            </h2>
            {day.entries.map((entry) => (
              <LogRow key={entry.id} entry={entry} needle={needle} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
