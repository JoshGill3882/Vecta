"use client";

import { useId, useState } from "react";

import type { TaskStatus } from "@/src/shared/lib/dtos/tasks";
import { usePointerCoarse } from "@/src/shared/hooks/use-pointer-coarse";
import { cn } from "@/src/shared/lib/utils";

import { DuePill } from "@/src/features/tasks/components/due-pill";
import { DueDateDesktop } from "@/src/features/tasks/components/dialog/due-date-desktop";
import { DueDateTouch } from "@/src/features/tasks/components/dialog/due-date-touch";
import { joinDueAt, splitDueAt } from "@/src/features/tasks/lib/due-date";

/** What the line under the field says when typed text names no date. */
const INVALID_HINT = "Try 24/09/2026, 24 Sep, today or +3.";

/** What `DueDateField` takes. */
interface DueDateFieldProps {
  /** The id the field's label points at. */
  id: string;
  /** The stored due date, or null for none. */
  value: string | null;
  /** Receives the new due date, or null when it is cleared. */
  onChange: (value: string | null) => void;
  /** The task's status as the form currently has it, so the preview matches the card. */
  status: TaskStatus;
  /** Disables every part, while the form is saving. */
  disabled?: boolean;
}

/** The task form's due date: a date, and a time when the time matters.
 *
 * Two versions, chosen by how the reader is pointing rather than by screen
 * width: the app's own typed field and calendar for a mouse and keyboard, the
 * device's pickers for touch. Both edit the one stored value, and share the line
 * underneath, which previews the pill the card will show.
 */
export function DueDateField({ id, value, onChange, status, disabled = false }: DueDateFieldProps) {
  const coarse = usePointerCoarse();
  const hintId = useId();
  const [invalid, setInvalid] = useState(false);
  const { date, time } = splitDueAt(value);

  /** Sets the date, keeping any time; clearing it clears the time too.
   *
   * @param next The date as `YYYY-MM-DD`, or empty to clear it.
   */
  function changeDate(next: string) {
    setInvalid(false);
    onChange(joinDueAt(next, time));
  }

  /** Sets or removes the time on the current date.
   *
   * @param next The time as `HH:MM`, or empty to remove it.
   */
  function changeTime(next: string) {
    onChange(joinDueAt(date, next));
  }

  // Typed text is only read by the mouse version, so only it can be rejected.
  const showHint = invalid && !coarse;

  return (
    <div>
      {coarse ? (
        <DueDateTouch
          id={id}
          date={date}
          time={time}
          onDateChange={changeDate}
          onTimeChange={changeTime}
          disabled={disabled}
        />
      ) : (
        <DueDateDesktop
          id={id}
          hintId={hintId}
          date={date}
          time={time}
          onDateChange={changeDate}
          onTimeChange={changeTime}
          invalid={invalid}
          onInvalidChange={setInvalid}
          disabled={disabled}
        />
      )}
      {/* A live region, so a rejected date is announced and not only coloured,
          and a screen reader hears the preview change as a date is picked. */}
      <p
        id={hintId}
        aria-live="polite"
        className={cn(
          "mt-2 flex min-h-[18px] flex-wrap items-center gap-[7px] text-xs",
          showHint ? "text-destructive" : "text-text-faint"
        )}
      >
        {showHint ? (
          INVALID_HINT
        ) : value ? (
          <>
            Shows as <DuePill task={{ dueAt: value, status }} now={new Date()} />
            {!time && <span>· due by end of day</span>}
          </>
        ) : (
          "No due date."
        )}
      </p>
    </div>
  );
}
