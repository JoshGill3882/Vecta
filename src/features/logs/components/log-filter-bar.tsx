"use client";

import { useOptimistic, useRef, useTransition, type Ref } from "react";
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
import { LOG_LEVELS, LOG_SOURCES, type LogFilters } from "@/src/shared/lib/schemas/logs";
import { toggled } from "@/src/shared/lib/selection";
import { entryCount, formatCount } from "@/src/features/logs/lib/log-format";
import { logsHref } from "@/src/features/logs/lib/log-links";

import { LEVEL_LABELS, SOURCE_LABELS, type LogLabel } from "./log-meta";

/** The levels and sources picked, which is all a filter change sets. */
type Choices = Pick<LogFilters, "level" | "source">;

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
  triggerRef,
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
  /** The menu's button, so focus can be sent to it. */
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTrigger ref={triggerRef} icon={icon} label={label} count={selected.length} />
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
  // Clear filters disappears once it is pressed, so focus is sent to the
  // first menu's button rather than being dropped onto the page.
  const levelTrigger = useRef<HTMLButtonElement>(null);

  /** Shows the entries a new set of choices matches, from the first page.
   *
   * @param next The levels and sources to show.
   */
  function apply(next: Choices) {
    startTransition(() => {
      setShown({ ...next, page: 1 });
      router.push(logsHref(next), { scroll: false });
    });
  }

  const filtered = shown.level.length > 0 || shown.source.length > 0;

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
          onSelectedChange={(level) => apply({ level, source: shown.source })}
          triggerRef={levelTrigger}
        />
        <FilterMenu
          label="Source"
          icon={Server}
          choices={LOG_SOURCES}
          labels={SOURCE_LABELS}
          counts={page.sourceCounts}
          selected={shown.source}
          onSelectedChange={(source) => apply({ level: shown.level, source })}
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
              levelTrigger.current?.focus();
              apply({ level: [], source: [] });
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
