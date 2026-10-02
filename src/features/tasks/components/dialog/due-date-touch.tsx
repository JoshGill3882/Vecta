"use client";

import { CalendarIcon, Clock } from "lucide-react";

import { Button } from "@/src/shared/components/ui/button";
import { cn } from "@/src/shared/lib/utils";

import { quickDates } from "@/src/features/tasks/lib/date-input";

/** The field outline around a native input and its icon, at touch height. */
const SHELL_CLASS =
  "border-input dark:bg-input/30 relative flex h-11 items-center gap-2 rounded-[9px] border px-[11px] transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-disabled:opacity-50";

/** A native date or time input stretched across its shell, dark to match the app.
 *
 * Typed at 16px: anything smaller makes iOS Safari zoom the page on focus.
 */
const INPUT_CLASS =
  "min-w-0 flex-1 self-stretch bg-transparent text-base outline-none scheme-dark disabled:cursor-not-allowed";

/** What `DueDateTouch` takes. */
interface DueDateTouchProps {
  /** The id the field's label points at, given to the date input. */
  id: string;
  /** The date as `YYYY-MM-DD`, or empty for none. */
  date: string;
  /** The time as `HH:MM`, or empty for none. */
  time: string;
  /** Receives a new date, or empty when it is cleared. */
  onDateChange: (date: string) => void;
  /** Receives a new time, or empty when it is removed. */
  onTimeChange: (time: string) => void;
  /** Disables every part, while the form is saving. */
  disabled: boolean;
}

/** The due-date field for touch: the device's own date and time pickers.
 *
 * Phone users expect the picker their phone always shows, and it is built for a
 * thumb and a screen reader already. Its values are `YYYY-MM-DD` and 24-hour
 * `HH:MM` whatever the phone displays, so they are stored exactly as the mouse
 * version's are. The quick dates and the clear actions sit underneath as chips,
 * since a native picker has nowhere to put them.
 */
export function DueDateTouch({
  id,
  date,
  time,
  onDateChange,
  onTimeChange,
  disabled,
}: DueDateTouchProps) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="min-w-[180px] flex-[1_1_190px]">
        <div className={SHELL_CLASS}>
          <CalendarIcon aria-hidden className="text-text-3 size-[15px] shrink-0" />
          <input
            id={id}
            type="date"
            value={date}
            disabled={disabled}
            onChange={(event) => onDateChange(event.target.value)}
            // An empty date input shows nothing on iOS and a format mask on
            // Android, so its own text is hidden and a placeholder drawn over it.
            className={cn(INPUT_CLASS, !date && "text-transparent")}
          />
          {!date && (
            <span
              aria-hidden
              className="text-text-faint pointer-events-none absolute left-[37px] text-base"
            >
              Pick a date
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quickDates(new Date()).map((quick) => (
            <Button
              key={quick.label}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={date === quick.dayKey}
              disabled={disabled}
              onClick={() => onDateChange(quick.dayKey)}
            >
              {quick.label}
            </Button>
          ))}
          {date && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onDateChange("")}
              className="text-text-3"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="min-w-[138px] flex-[0_1_146px]">
        <div className={SHELL_CLASS}>
          <Clock aria-hidden className="text-text-3 size-[15px] shrink-0" />
          <input
            type="time"
            aria-label="Due time"
            value={time}
            disabled={disabled || !date}
            // Some browsers report seconds as well; the stored form is HH:MM.
            onChange={(event) => onTimeChange(event.target.value.slice(0, 5))}
            className={INPUT_CLASS}
          />
        </div>
        {time && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onTimeChange("")}
            className="text-text-3 mt-2"
          >
            Remove time
          </Button>
        )}
      </div>
    </div>
  );
}
