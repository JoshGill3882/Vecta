"use client";

import { SearchField } from "./search-field";

/**
 * The row of controls above the task list.
 *
 * Its own component because every such control belongs in this row, and
 * `tasks-view.tsx` already owns the derivation, the dialogs and the delete focus
 * handling. Growing the view by a control at a time is how it stops being readable.
 *
 * Wrapping rather than a breakpoint: the field claims the row and the controls
 * drop below it once they no longer fit, so the layout follows how many controls
 * there are rather than a guess about screen width.
 */
export function TasksToolbar({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      <SearchField value={query} onChange={onQueryChange} />
    </div>
  );
}
