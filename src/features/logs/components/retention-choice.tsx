"use client";

import { useOptimistic, useTransition } from "react";
import { ChevronDownIcon, Clock } from "lucide-react";
import { RadioGroup } from "radix-ui";

import { setLogRetentionAction } from "@/src/features/logs/actions";
import { Button } from "@/src/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";
import { useServerAction } from "@/src/shared/hooks/use-server-action";
import type { LogRetentionDays } from "@/src/shared/lib/dtos/settings";

/** The retention choices, in the order the card offers them. */
const CHOICES: { days: LogRetentionDays; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
  { days: 0, label: "Forever" },
];

/** Names one retention.
 *
 * @param days The retention.
 * @returns Its label, such as `30 days` or `Forever`.
 */
function labelOf(days: LogRetentionDays): string {
  return CHOICES.find((choice) => choice.days === days)?.label ?? "";
}

/** Writes the message shown once a new retention is saved.
 *
 * @param days The retention just saved.
 * @returns The message, such as `Keeping log entries for 30 days`.
 */
function savedMessage(days: LogRetentionDays): string {
  if (days === 0) return "Keeping log entries forever";
  return `Keeping log entries for ${labelOf(days)}`;
}

/** The five choices as one row of segments, for a column wide enough to hold them. */
function RetentionSegments({
  shown,
  onChoose,
}: {
  /** The choice shown as picked. */
  shown: LogRetentionDays;
  /** Called with the picked choice's days, as text. */
  onChoose: (value: string) => void;
}) {
  return (
    <RadioGroup.Root
      aria-label="Keep log entries for"
      value={String(shown)}
      onValueChange={onChoose}
      loop
      className="border-input bg-input/30 flex w-max rounded-lg border p-0.5 @max-[360px]:hidden"
    >
      {CHOICES.map((choice) => (
        <RadioGroup.Item
          key={choice.days}
          value={String(choice.days)}
          className="text-text-3 hover:text-foreground focus-visible:ring-ring data-[state=checked]:bg-surface-3 data-[state=checked]:text-foreground inline-flex h-[30px] items-center rounded-lg px-2 text-[13px] font-medium outline-none focus-visible:ring-2 pointer-coarse:h-11 sm:px-2.5"
        >
          {choice.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

/** The five choices behind one button, for a column too narrow to hold them in a row.
 *
 * The button reads the saved choice, so the card still says how long entries
 * are kept without being opened, and the menu is as wide as the button.
 */
function RetentionMenu({
  shown,
  onChoose,
}: {
  /** The choice shown as picked. */
  shown: LogRetentionDays;
  /** Called with the picked choice's days, as text. */
  onChoose: (value: string) => void;
}) {
  const label = labelOf(shown);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Keep log entries for: ${label}`}
          className="hidden h-11 w-full max-w-[320px] justify-start @max-[360px]:inline-flex"
        >
          <Clock aria-hidden className="text-text-3" />
          {shown === 0 ? "Keep forever" : `Keep for ${label}`}
          <ChevronDownIcon
            aria-hidden
            className="text-text-3 ml-auto transition-transform duration-150 group-aria-expanded/button:rotate-180"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuLabel className="text-text-faint text-[11px] tracking-[0.04em] uppercase">
          Keep log entries for
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          aria-label="Keep log entries for"
          value={String(shown)}
          onValueChange={onChoose}
        >
          {CHOICES.map((choice) => (
            <DropdownMenuRadioItem
              key={choice.days}
              value={String(choice.days)}
              className="min-h-11"
            >
              {choice.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Retention card's choice of how long log entries are kept.
 *
 * A row of segments while the column has room for all five on one line, and
 * a dropdown in its place once it has not, so the choice never wraps. Which
 * shows is decided by a container query on the column rather than a media
 * query on the window, since the column's width depends on the card's layout
 * as well as the screen's. Both are always rendered and CSS hides one, so a
 * change of width needs no JavaScript.
 *
 * The segments are one tab stop, with the arrow keys moving between the
 * choices, as a group of radio buttons works. A choice made in either shows as
 * picked straight away, and goes back if saving it fails.
 */
export function RetentionChoice({ days }: { days: LogRetentionDays }) {
  const runAction = useServerAction();
  const [shown, setShown] = useOptimistic(days);
  const [, startTransition] = useTransition();

  /** Shows a choice as picked and saves it.
   *
   * @param value The picked choice's days, as both controls give it: text.
   */
  function choose(value: string) {
    // One of the values the controls offer, so a known choice; the action checks it again.
    const next = Number(value) as LogRetentionDays;
    // The menu reports a pick of the choice already made; there is nothing to save.
    if (next === shown) return;
    startTransition(async () => {
      setShown(next);
      await runAction(setLogRetentionAction(next), { success: savedMessage(next) });
    });
  }

  return (
    // `w-full` because a size container cannot take its width from what it holds.
    <div className="@container w-full">
      <RetentionSegments shown={shown} onChoose={choose} />
      <RetentionMenu shown={shown} onChoose={choose} />
    </div>
  );
}
