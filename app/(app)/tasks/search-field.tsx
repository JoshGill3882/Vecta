"use client";

import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

/**
 * DOM id of the search input. The last link in the post-delete focus chain:
 * deleting the last match in a status drops that section while the list is
 * narrowed, so there is no header to return to - and no empty state either,
 * while other statuses still show results.
 */
export const tasksSearchFieldId = "tasks-search-field";

export function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Never steal a keystroke that is part of typing: not from another field,
      // not from a shortcut, and not from a half-composed IME character, where
      // "/" is a literal input rather than a command.
      if (event.key !== "/" || event.isComposing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }

      event.preventDefault();
      ref.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative mb-3.5 flex-1">
      <Search className="text-text-faint pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2" />
      <Input
        id={tasksSearchFieldId}
        ref={ref}
        type="search"
        aria-label="Search tasks"
        placeholder="Search tasks..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Escape clears a query, and steps back out of the field once there is nothing left to clear
        // Stopping propagation only while it clears keep Escape meaning "close" everywhere else
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          if (value) {
            event.stopPropagation();
            onChange("");
          } else {
            ref.current?.blur();
          }
        }}
        // `type="search"` draws a native clear button in Chrome and Safari.
        // Ours sits in the aame place, so the native one is suppressed rather than shown alongside it.
        className="h-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="text-text-3 absolute top-1/2 right-1 size-7 -translate-y-1/2"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
