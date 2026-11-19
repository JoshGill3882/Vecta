"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/src/shared/components/ui/button";
import { Input } from "@/src/shared/components/ui/input";
import { LOG_SEARCH_MAX } from "@/src/shared/lib/schemas/logs";

/** The Logs page's search box, with a button that clears it.
 *
 * It keeps nothing of its own: the filter bar holds what is typed, so a filter
 * picked while a search is still waiting to be sent carries the search too.
 * Escape clears it, as the clear button does, and both leave focus in the box,
 * ready for the next search.
 */
export function LogSearchField({
  value,
  onChange,
  onClear,
}: {
  /** What is typed in the box. */
  value: string;
  /** Called with the box's text after each keystroke. */
  onChange: (value: string) => void;
  /** Called when the box is cleared. */
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  /** Clears the box and keeps focus in it, since the clear button disappears once pressed. */
  function clear() {
    onClear();
    ref.current?.focus();
  }

  return (
    <div className="relative min-w-52 flex-1">
      <Search
        aria-hidden
        className="text-text-faint pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2"
      />
      <Input
        ref={ref}
        type="search"
        aria-label="Search log entries"
        placeholder="Search messages and details..."
        maxLength={LOG_SEARCH_MAX}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Escape is only taken while there is something to clear, so it still
        // closes whatever else it would close once the box is empty.
        onKeyDown={(event) => {
          if (event.key !== "Escape" || value === "") return;
          event.stopPropagation();
          clear();
        }}
        // `type="search"` draws a clear button of its own in Chrome and Safari,
        // in the same place as this one, so it is hidden rather than shown twice.
        className="h-9 pr-9 pl-9 pointer-coarse:h-11 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value !== "" && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          onClick={clear}
          className="text-text-3 absolute top-1/2 right-1 size-7 -translate-y-1/2"
        >
          <X aria-hidden className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
