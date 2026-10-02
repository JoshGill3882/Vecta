"use client";

import { useRef } from "react";
import { Time } from "@internationalized/date";
import { ChevronDown, ChevronUp, Clock, X } from "lucide-react";
import { DateInput, DateSegment, TimeField } from "react-aria-components";

import { Button } from "@/src/shared/components/ui/button";
import { cn } from "@/src/shared/lib/utils";

/** The parts of a time the ▲▼ buttons can step. */
type StepSegment = "hour" | "minute";

/** Styling for the ▲▼ buttons: small steppers for a mouse, out of the tab order. */
const STEP_BUTTON_CLASS =
  "text-text-faint hover:bg-surface-3 hover:text-foreground flex h-[15px] w-[18px] items-center justify-center rounded-[4px] disabled:pointer-events-none disabled:opacity-50";

/** Reads a time as the form stores it into React Aria's `Time`.
 *
 * @param value The time as `HH:MM`, or empty for none.
 * @returns The time, or null when there is none.
 */
function toTime(value: string): Time | null {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  return new Time(hour, minute);
}

/** Writes React Aria's `Time` back as the form stores it.
 *
 * @param time The time, or null for none.
 * @returns The time as `HH:MM`, or empty for none.
 */
function toText(time: Time | null): string {
  if (!time) return "";
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

/** What `DueTimeField` takes. */
interface DueTimeFieldProps {
  /** The time as `HH:MM`, or empty for none. */
  value: string;
  /** Receives the new time as `HH:MM`, or empty when it is removed. */
  onChange: (value: string) => void;
  /** Disables every part, for a task with no due date. */
  disabled?: boolean;
  /** Classes for the outer shell, which draws the field's border. */
  className?: string;
}

/** A 24-hour `HH : MM` field for a due time, with ▲▼ steppers and a remove button.
 *
 * Built on React Aria's `TimeField`, which makes each segment a spinbutton with
 * its own keyboard handling. A half-typed time is not reported: `onChange` fires
 * once both segments hold a value, and with an empty string once both are cleared.
 */
export function DueTimeField({ value, onChange, disabled = false, className }: DueTimeFieldProps) {
  // Which segment ▲▼ step: the last one focused, since pressing a button moves
  // nothing - its mousedown is cancelled so focus stays where it was.
  const lastSegment = useRef<StepSegment>("hour");
  const time = toTime(value);

  /** Steps the last-focused segment, wrapping within it, from midnight when empty.
   *
   * @param amount One up or one down.
   */
  function step(amount: 1 | -1) {
    onChange(toText((time ?? new Time()).cycle(lastSegment.current, amount)));
  }

  return (
    <div
      // Focus bubbles up from the segment that took it, which names its own part
      // in `data-type`; the literal `:` between them is never focusable.
      onFocus={(event) => {
        const type = event.target.dataset.type;
        if (type === "hour" || type === "minute") lastSegment.current = type;
      }}
      className={cn("flex items-center gap-1", disabled && "opacity-50", className)}
    >
      <Clock aria-hidden className="text-text-3 size-[15px] shrink-0" />
      <TimeField
        aria-label="Due time"
        hourCycle={24}
        shouldForceLeadingZeros
        value={time}
        onChange={(next) => onChange(toText(next))}
        isDisabled={disabled}
        className="flex-1"
      >
        <DateInput className="flex items-center text-sm tabular-nums">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="data-placeholder:text-text-faint data-[type=literal]:text-text-3 data-focused:bg-primary/25 rounded-[4px] px-0.5 outline-none"
            />
          )}
        </DateInput>
      </TimeField>
      <span className="flex shrink-0 flex-col">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Increase time"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => step(1)}
          className={STEP_BUTTON_CLASS}
        >
          <ChevronUp aria-hidden className="size-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Decrease time"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => step(-1)}
          className={STEP_BUTTON_CLASS}
        >
          <ChevronDown aria-hidden className="size-3" />
        </button>
      </span>
      {/* Hidden rather than removed when there is nothing to remove, so the
          field does not change width as a time comes and goes. `invisible`
          also takes it out of the tab order and away from screen readers. */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Remove time"
        title="Remove time"
        onClick={() => onChange("")}
        className={cn("text-text-3", (!time || disabled) && "invisible")}
      >
        <X aria-hidden className="size-3.5" />
      </Button>
    </div>
  );
}
