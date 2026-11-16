"use client";

import { useOptimistic, useTransition } from "react";
import { RadioGroup } from "radix-ui";

import { setLogRetentionAction } from "@/src/features/logs/actions";
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

/** Writes the message shown once a new retention is saved.
 *
 * @param days The retention just saved.
 * @returns The message, such as `Keeping log entries for 30 days`.
 */
function savedMessage(days: LogRetentionDays): string {
  if (days === 0) return "Keeping log entries forever";
  const label = CHOICES.find((choice) => choice.days === days)?.label;
  return `Keeping log entries for ${label}`;
}

/** The Retention card's choice of how long log entries are kept.
 *
 * One tab stop, with the arrow keys moving between the choices, as a group of
 * radio buttons works. A choice shows as picked straight away, and goes back
 * if saving it fails.
 */
export function RetentionChoice({ days }: { days: LogRetentionDays }) {
  const runAction = useServerAction();
  const [shown, setShown] = useOptimistic(days);
  const [, startTransition] = useTransition();

  /** Shows a choice as picked and saves it.
   *
   * @param value The picked choice's days, as the radio group gives it: text.
   */
  function choose(value: string) {
    // One of the values below, so a known choice; the action checks it again.
    const next = Number(value) as LogRetentionDays;
    startTransition(async () => {
      setShown(next);
      await runAction(setLogRetentionAction(next), { success: savedMessage(next) });
    });
  }

  return (
    <RadioGroup.Root
      aria-label="Keep log entries for"
      value={String(shown)}
      onValueChange={choose}
      loop
      className="border-input bg-input/30 flex flex-wrap rounded-lg border p-0.5"
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
