"use client";

import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/src/shared/components/ui/button";
import { Input } from "@/src/shared/components/ui/input";

/** A page's search box, with a button that clears it.
 *
 * It keeps nothing of its own: the page holds what is typed. The clear button
 * and Escape both empty it and leave focus in it, ready for the next search,
 * since the clear button disappears once pressed. Escape in an empty box steps
 * back out of it instead.
 */
export function SearchField({
  id,
  label,
  placeholder,
  value,
  onChange,
  onClear,
  maxLength,
  slashShortcut = false,
}: {
  /** The input's DOM id, for a page that sends the focus to the box. */
  id?: string;
  /** The box's accessible name, such as `Search tasks`. */
  label: string;
  /** The hint shown while the box is empty. */
  placeholder: string;
  /** What is typed in the box. */
  value: string;
  /** Called with the box's text after each keystroke. */
  onChange: (value: string) => void;
  /** Called when the box is cleared. Without it, clearing calls `onChange` with an empty string. */
  onClear?: () => void;
  /** The most characters the box takes. */
  maxLength?: number;
  /** Whether a bare `/` typed anywhere on the page focuses the box. */
  slashShortcut?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slashShortcut) return;

    /** Focuses the box on a bare slash, without stealing a typed one.
     *
     * @param event The key event, whose target says whether typing is underway.
     */
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
      )
        return;

      event.preventDefault();
      ref.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slashShortcut]);

  /** Empties the box and keeps focus in it. */
  function clear() {
    if (onClear) onClear();
    else onChange("");
    ref.current?.focus();
  }

  return (
    <div className="relative min-w-52 flex-1">
      <Search
        aria-hidden
        className="text-text-faint pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2"
      />
      <Input
        id={id}
        ref={ref}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Escape is only kept from the rest of the page while it clears, so once
        // the box is empty it still closes whatever else it would close.
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          if (value === "") {
            ref.current?.blur();
            return;
          }
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
