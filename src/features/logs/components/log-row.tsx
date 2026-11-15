import { ChevronDown } from "lucide-react";

import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { detailLayout } from "@/src/features/logs/lib/detail-fields";
import { entryMessage } from "@/src/features/logs/lib/entry-message";
import { logTime } from "@/src/features/logs/lib/log-format";
import { cn } from "@/src/shared/lib/utils";

import { LevelBadge } from "./level-badge";
import { SOURCE_LABELS } from "./log-meta";

/** The list's columns on a wide screen, shared with the column header so the
 * two line up: time, level, source, message, and the chevron. */
export const LOG_COLUMNS = "min-[720px]:grid-cols-[76px_104px_118px_minmax(0,1fr)_18px]";

/** Everything recorded with an entry, shown once its row is opened.
 *
 * The entry's own fields come first, then its detail. Every value is rendered
 * as text, so a task title holding markup shows as typed.
 */
function LogDetail({ entry }: { entry: LogEntryDTO }) {
  const { fields, stacks } = detailLayout(entry.detail);
  const rows = [
    { name: "Timestamp", value: entry.createdAt },
    { name: "Entry ID", value: entry.id },
    { name: "Kind", value: entry.kind },
    { name: "Event", value: entry.event },
    ...fields,
  ];

  return (
    // Indented on a wide screen to start under the level, past the time.
    <div className="bg-surface-2 px-3.5 pt-1 pb-3.5 min-[720px]:pr-4 min-[720px]:pb-4 min-[720px]:pl-[106px]">
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-[5px] text-[12.5px]">
        {rows.map(({ name, value }) => (
          <div key={name} className="contents">
            <dt className="text-text-3">{name}</dt>
            <dd className="text-text-2 font-mono [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>

      {stacks.map(({ name, value }) => (
        <div key={name} className="mt-3">
          <p className="text-text-3 mb-1.5 text-[12.5px]">{name}</p>
          {/* Focusable, so a keyboard can scroll a stack taller or wider than its box. */}
          <pre
            tabIndex={0}
            aria-label={name}
            className="bg-background text-text-2 focus-visible:ring-ring max-h-[220px] overflow-auto rounded-lg border px-3 py-2.5 font-mono text-xs leading-[1.55] whitespace-pre focus-visible:ring-2 focus-visible:outline-none"
          >
            {value}
          </pre>
        </div>
      ))}
    </div>
  );
}

/** One entry: a summary line that opens to show everything recorded with it.
 *
 * Built on `<details>`, so the browser opens and closes it, announces whether
 * it is open, and handles the keyboard, with no JavaScript. Several rows can be
 * open at once, to compare entries side by side.
 *
 * On a phone the line wraps in two: level, source, time and chevron above, the
 * message beneath across the whole width.
 */
export function LogRow({ entry }: { entry: LogEntryDTO }) {
  const { label: source, Icon: SourceIcon } = SOURCE_LABELS[entry.source];
  const message = entryMessage(entry);

  return (
    <details className="group border-border-faint border-b">
      <summary
        className={cn(
          "grid min-h-11 cursor-pointer list-none items-center transition-colors [&::-webkit-details-marker]:hidden",
          "hover:bg-surface-2/70 group-open:bg-surface-2",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
          // Phone: two lines, the message on its own beneath.
          "grid-cols-[auto_minmax(0,1fr)_auto_18px] gap-x-2.5 gap-y-1.5 px-3.5 py-2.5 [grid-template-areas:'lvl_src_time_chev'_'msg_msg_msg_msg']",
          // Wide screen: one line, in the column header's columns.
          LOG_COLUMNS,
          "min-[720px]:gap-x-3.5 min-[720px]:px-4 min-[720px]:py-[7px] min-[720px]:[grid-template-areas:'time_lvl_src_msg_chev']"
        )}
      >
        <time
          dateTime={entry.createdAt}
          title={entry.createdAt}
          className="text-text-3 font-mono text-[12.5px] tabular-nums [grid-area:time]"
        >
          {logTime(entry.createdAt)}
        </time>
        <span className="flex [grid-area:lvl]">
          <LevelBadge level={entry.level} />
        </span>
        <span className="text-text-2 flex items-center gap-1.5 text-[13px] [grid-area:src]">
          <SourceIcon className="text-text-3 size-[13px] shrink-0" aria-hidden />
          {source}
        </span>
        <span
          title={message}
          className="line-clamp-2 text-[13.5px] [overflow-wrap:anywhere] [grid-area:msg] min-[720px]:line-clamp-1"
        >
          {message}
        </span>
        <ChevronDown
          className="text-text-3 size-[15px] transition-transform [grid-area:chev] group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <LogDetail entry={entry} />
    </details>
  );
}
