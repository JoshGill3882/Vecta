"use client";

import { useState } from "react";
import { CalendarIcon, CalendarOff } from "lucide-react";
import { enGB } from "react-day-picker/locale";

import { Button } from "@/src/shared/components/ui/button";
import { Calendar } from "@/src/shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/shared/components/ui/popover";
import { cn } from "@/src/shared/lib/utils";

import { DueTimeField } from "@/src/features/tasks/components/dialog/due-time-field";
import {
  dateOfDayKey,
  dayKeyOf,
  formatDateInput,
  parseDateInput,
  quickDates,
} from "@/src/features/tasks/lib/date-input";

/** The border and focus ring both fields share, drawn around an input and its buttons. */
const SHELL_CLASS =
  "border-input dark:bg-input/30 flex h-10 items-center gap-1 rounded-[9px] border pr-1 pl-[11px] transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20";

/** What `DueDateDesktop` takes. */
interface DueDateDesktopProps {
  /** The id the field's label points at, given to the date input. */
  id: string;
  /** The id of the line under the field, which explains a rejected date. */
  hintId: string;
  /** The date as `YYYY-MM-DD`, or empty for none. */
  date: string;
  /** The time as `HH:MM`, or empty for none. */
  time: string;
  /** Receives a new date, or empty when it is cleared; setting one clears `invalid`. */
  onDateChange: (date: string) => void;
  /** Receives a new time, or empty when it is removed. */
  onTimeChange: (time: string) => void;
  /** Whether the typed text names no date. */
  invalid: boolean;
  /** Marks the typed text as rejected, or accepted again. */
  onInvalidChange: (invalid: boolean) => void;
  /** Disables every part, while the form is saving. */
  disabled: boolean;
}

/** The due-date field for a mouse and keyboard: typed, picked, or both.
 *
 * The date is typed in any of the formats `parseDateInput` reads, or picked
 * from a calendar. Typed text is read when the field is left or Enter is
 * pressed, not on every keystroke, so a half-typed date is never mistaken for a
 * whole one. Once read, it is rewritten in one standard form.
 */
export function DueDateDesktop({
  id,
  hintId,
  date,
  time,
  onDateChange,
  onTimeChange,
  invalid,
  onInvalidChange,
  disabled,
}: DueDateDesktopProps) {
  const [text, setText] = useState(date ? formatDateInput(date) : "");
  const [shownDate, setShownDate] = useState(date);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // A date set from outside the text - the calendar, a quick button, a clear -
  // rewrites the text to match. Done while rendering rather than in an effect,
  // so the field never paints the old text first.
  if (date !== shownDate) {
    setShownDate(date);
    setText(date ? formatDateInput(date) : "");
  }

  /** Reads the typed text and sets the date it names, or marks it rejected. */
  function commit() {
    const result = parseDateInput(text, new Date());
    if (result.status === "invalid") {
      onInvalidChange(true);
      return;
    }
    const next = result.status === "valid" ? result.dayKey : "";
    setText(next ? formatDateInput(next) : "");
    onDateChange(next);
  }

  /** Sets a picked date and closes the calendar.
   *
   * @param dayKey The date as `YYYY-MM-DD`.
   */
  function pick(dayKey: string) {
    onDateChange(dayKey);
    setCalendarOpen(false);
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className={cn(SHELL_CLASS, "min-w-[180px] flex-[1_1_190px]")}>
        <CalendarIcon aria-hidden className="text-text-3 size-[15px] shrink-0" />
        <input
          id={id}
          autoComplete="off"
          placeholder="Type or pick a date"
          value={text}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={hintId}
          onChange={(event) => {
            setText(event.target.value);
            onInvalidChange(false);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            // Enter reads the date rather than submitting the whole form.
            if (event.key !== "Enter") return;
            event.preventDefault();
            commit();
          }}
          className="placeholder:text-text-faint min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        />
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Open calendar"
              disabled={disabled}
              className="text-text-3 aria-expanded:text-primary"
            >
              <CalendarIcon aria-hidden className="size-[15px]" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto gap-1.5 p-1.5">
            <Calendar
              mode="single"
              required
              locale={enGB}
              showOutsideDays={false}
              selected={date ? dateOfDayKey(date) : undefined}
              defaultMonth={date ? dateOfDayKey(date) : undefined}
              onSelect={(day) => pick(dayKeyOf(day))}
              formatters={{
                formatWeekdayName: (day) => day.toLocaleDateString("en-GB", { weekday: "narrow" }),
              }}
              // 36px cells make the month 252px wide. Today is outlined rather
              // than filled, so it never reads as the selected day.
              className="p-0 [--cell-size:--spacing(9)]"
              classNames={{
                today:
                  "[&>button]:border [&>button]:border-primary/55 [&>button]:font-semibold data-[selected=true]:[&>button]:border-transparent",
              }}
            />
            <div className="bg-border mx-0.5 h-px" />
            <div className="flex flex-wrap gap-1">
              {quickDates(new Date()).map((quick) => (
                <Button
                  key={quick.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => pick(quick.dayKey)}
                >
                  {quick.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <DueTimeField
        value={time}
        onChange={onTimeChange}
        disabled={disabled || !date}
        className={cn(SHELL_CLASS, "min-w-[138px] flex-[0_1_146px]")}
      />

      {date && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear due date"
          title="Clear due date"
          disabled={disabled}
          onClick={() => onDateChange("")}
          className="text-text-3 size-10"
        >
          <CalendarOff aria-hidden className="size-4" />
        </Button>
      )}
    </div>
  );
}
