import { Fragment } from "react";

import { findMatches } from "@/src/lib/task-search";

/**
 * Wraps each occurrence of `needle` in `text` in a <mark>. Purely presentational:
 * the surrounding text nodes still concatenate to the original string, so a
 * screen reader reads one title rather than a run of fragments.
 */
export function Highlight({ text, needle }: { text: string; needle: string }) {
  const ranges = findMatches(text, needle);
  if (ranges.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  ranges.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={index} className="rounded-[3px] bg-amber-200/70 text-inherit dark:bg-amber-400/30">
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  });

  if (cursor < text.length) parts.push(text.slice(cursor));

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  );
}
