"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Funnel, Server, type LucideIcon } from "lucide-react";

import type { LogPage } from "@/src/server/services/logs";
import { FilterTrigger } from "@/src/shared/components/filter-trigger";
import { Button } from "@/src/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";
import {
  isFiltered,
  LOG_LEVELS,
  LOG_SOURCES,
  NO_FILTERS,
  type LogFilters,
  type LogNarrowing,
} from "@/src/shared/lib/schemas/logs";
import { toggled } from "@/src/shared/lib/selection";
import { entryCount, formatCount } from "@/src/features/logs/lib/log-format";
import { logsHref } from "@/src/features/logs/lib/log-links";

import { LEVEL_LABELS, SOURCE_LABELS, type LogLabel } from "./log-meta";

/** Finds the button that clearing the filters sends focus to.
 *
 * It is marked with a data attribute rather than an id, since the menu gives
 * its button an id of its own, which names the open menu for a screen reader.
 */
const FOCUS_TARGET = "[data-filter-focus-target]";

/** Sends focus to the first filter's button.
 *
 * Every Clear filters control disappears once it is pressed, so each sends
 * focus here first, where the reader can filter again, rather than leaving it
 * wherever the control was.
 */
export function focusFilters(): void {
  document.querySelector<HTMLElement>(FOCUS_TARGET)?.focus();
}

/** One filter's menu: a checkbox per choice, each with how many entries it holds.
 *
 * Built like the task list's filters, as checkboxes behind a button with a
 * count, so a filter works the same way on every page. Picking a choice keeps
 * the menu open, so several can be picked in a row.
 */
function FilterMenu<T extends string>({
  label,
  icon,
  choices,
  labels,
  counts,
  selected,
  onSelectedChange,
  focusTarget = false,
}: {
  /** The button's name, such as `Level`. */
  label: string;
  /** The button's icon. */
  icon: LucideIcon;
  /** Every choice, in the order the menu lists them. */
  choices: readonly T[];
  /** Each choice's name and icon. */
  labels: Record<T, LogLabel>;
  /** How many entries each choice holds, whatever the filters. */
  counts: Record<T, number>;
  /** The choices picked. */
  selected: readonly T[];
  /** Called with the choices picked once one is added or taken away. */
  onSelectedChange: (next: T[]) => void;
  /** Whether clearing the filters sends focus to this menu's button. */
  focusTarget?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger
          data-filter-focus-target={focusTarget ? "" : undefined}
          icon={icon}
          label={label}
          count={selected.length}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[210px]">
        {choices.map((choice) => {
          const { label: name, Icon } = labels[choice];
          return (
            <DropdownMenuCheckboxItem
              key={choice}
              checked={selected.includes(choice)}
              onCheckedChange={() => onSelectedChange([...toggled(new Set(selected), choice)])}
              onSelect={(event) => event.preventDefault()}
            >
              <Icon aria-hidden className="text-text-3 size-[13px]" />
              <span>{name}</span>
              <span className="text-text-3 ml-auto text-xs tabular-nums">
                {formatCount(counts[choice])}
              </span>
            </DropdownMenuCheckboxItem>
          );
        })}

        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onSelectedChange([])}>
              Clear {label.toLowerCase()}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Logs page's Level and Source filters, and what they currently show.
 *
 * The filters live in the URL, not in this component: each change navigates
 * to the page's address with the new choices, and the server lists what they
 * match. A refresh, the back button or a shared link therefore keeps them.
 *
 * The menus tick a choice the moment it is picked rather than once the server
 * answers, through an optimistic copy of the filters that gives way to the
 * real ones when the new page arrives.
 */
export function LogFilterBar({ page, filters }: { page: LogPage; filters: LogFilters }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(filters);

  /** Shows the entries a new set of filters matches, from the first page.
   *
   * @param next The filters to show.
   */
  function apply(next: LogNarrowing) {
    const chosen = { ...next, page: 1 };
    startTransition(() => {
      setShown(chosen);
      router.push(logsHref(chosen), { scroll: false });
    });
  }

  const filtered = isFiltered(shown);

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterMenu
          label="Level"
          icon={Funnel}
          choices={LOG_LEVELS}
          labels={LEVEL_LABELS}
          counts={page.levelCounts}
          selected={shown.level}
          onSelectedChange={(level) => apply({ ...shown, level })}
          focusTarget
        />
        <FilterMenu
          label="Source"
          icon={Server}
          choices={LOG_SOURCES}
          labels={SOURCE_LABELS}
          counts={page.sourceCounts}
          selected={shown.source}
          onSelectedChange={(source) => apply({ ...shown, source })}
        />
      </div>

      {filtered && (
        <div className="text-text-2 mt-3 flex items-center gap-2.5 text-[13.5px]">
          {/* A status, so a screen reader hears the new count as the filters change. */}
          <p role="status">
            <strong className="font-semibold">{formatCount(page.matching)}</strong> of{" "}
            {entryCount(page.total)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-text-3"
            onClick={() => {
              focusFilters();
              apply(NO_FILTERS);
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
