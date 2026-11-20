"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, Clock, Funnel, Server, type LucideIcon } from "lucide-react";

import type { LogPage } from "@/src/server/services/logs";
import { FilterTrigger } from "@/src/shared/components/filter-trigger";
import { Button } from "@/src/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";
import {
  isFiltered,
  LOG_LEVELS,
  LOG_RANGES,
  LOG_SOURCES,
  NO_FILTERS,
  type LogFilters,
  type LogNarrowing,
  type LogRange,
} from "@/src/shared/lib/schemas/logs";
import { toggled } from "@/src/shared/lib/selection";
import { entryCount, formatCount } from "@/src/features/logs/lib/log-format";
import { logsHref } from "@/src/features/logs/lib/log-links";

import { LogFilterSheet } from "./log-filter-sheet";
import { LogSearchField } from "./log-search-field";
import { ANY_TIME, LEVEL_LABELS, RANGE_LABELS, SOURCE_LABELS, type LogLabel } from "./log-meta";

/** How long the search waits after the last keystroke before it is sent, in milliseconds.
 *
 * Long enough that a word typed at speed is one request rather than one a
 * letter, short enough that the list keeps up with a pause.
 */
const SEARCH_WAIT = 300;

/** The range menu's value for no range, since a menu's values are strings. */
const ANY = "any";

/** Finds the buttons that clearing the filters sends focus to: the Level button, and the sheet's button that stands in for it on a narrow screen.
 *
 * They are marked with a data attribute rather than an id, since the menu
 * gives its button an id of its own, which names the open menu for a screen
 * reader.
 */
const FOCUS_TARGET = "[data-filter-focus-target]";

/** Sends focus to the first filter's button, or to the sheet's button where the filters are folded into it.
 *
 * Every Clear filters control disappears once it is pressed, so each sends
 * focus here first, where the reader can filter again, rather than leaving it
 * wherever the control was. Both buttons are always rendered, with CSS hiding
 * one, so the one on screen is the one with a box.
 */
export function focusFilters(): void {
  const targets = Array.from(document.querySelectorAll<HTMLElement>(FOCUS_TARGET));
  (targets.find((target) => target.getClientRects().length > 0) ?? targets[0])?.focus();
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

/** The range filter's menu: Any time or one recent period, with the choice named on its button.
 *
 * Only one range can be on, so its choices are radio items and the menu closes
 * once one is picked. The button names the range rather than counting it, and
 * a screen reader hears it as "Time range, Last 7 days", since the range alone
 * would not say what the button is for.
 */
function RangeMenu({
  range,
  onRangeChange,
}: {
  /** The range picked, or null for Any time. */
  range: LogRange | null;
  /** Called with the range picked, or null for Any time. */
  onRangeChange: (next: LogRange | null) => void;
}) {
  const label = range === null ? ANY_TIME : RANGE_LABELS[range];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={range === null ? "outline" : "secondary"}
          aria-label={`Time range, ${label}`}
        >
          <Clock aria-hidden />
          {label}
          <ChevronDownIcon
            aria-hidden
            className="text-text-3 transition-transform duration-150 group-aria-expanded/button:rotate-180"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[190px]">
        <DropdownMenuRadioGroup
          value={range ?? ANY}
          onValueChange={(value) => onRangeChange(LOG_RANGES.find((r) => r === value) ?? null)}
        >
          <DropdownMenuRadioItem value={ANY}>{ANY_TIME}</DropdownMenuRadioItem>
          {LOG_RANGES.map((r) => (
            <DropdownMenuRadioItem key={r} value={r}>
              {RANGE_LABELS[r]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Logs page's search, its Level, Source and range filters, and what they currently show.
 *
 * The filters live in the URL, not in this component: each change navigates
 * to the page's address with the new choices, and the server lists what they
 * match. A refresh, the back button or a shared link therefore keeps them.
 *
 * The menus tick a choice the moment it is picked rather than once the server
 * answers, through an optimistic copy of the filters that gives way to the
 * real ones when the new page arrives.
 *
 * The search is sent once typing pauses, and replaces the address rather than
 * adding to the history, so the back button steps past a search instead of
 * through it a word at a time. What is typed is held here until then, and a
 * menu picked meanwhile sends it with its own choice.
 *
 * Two layouts, switched at the same 720px as the task list's toolbar. From
 * there up, the menus sit beside the search box and wrap below it if they run
 * out of room. Below it they fold into one button that opens a sheet, so the
 * search box and its filters stay on one row.
 */
export function LogFilterBar({ page, filters }: { page: LogPage; filters: LogFilters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(filters);
  const [text, setText] = useState(filters.q);
  const [seenQ, setSeenQ] = useState(filters.q);
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // The search can change without the box: Clear filters in the empty state,
  // a purge, or the back button. The box follows it then, but not while a
  // search of its own is waiting or on its way, which would lose what has been
  // typed since; nor when it differs only by spaces at the ends, which the
  // address trims, so a space typed before the next word stays.
  if (filters.q !== seenQ) {
    setSeenQ(filters.q);
    if (!waiting && !isPending && filters.q !== text.trim()) setText(filters.q);
  }

  /** Shows the entries a new set of filters matches, from the first page.
   *
   * Sends any search still waiting, since the filters given carry it.
   *
   * @param next The filters to show.
   * @param history Whether the new address adds to the history or replaces it.
   */
  function apply(next: LogNarrowing, history: "push" | "replace" = "push") {
    clearTimeout(timer.current);
    setWaiting(false);
    const chosen = { ...next, page: 1 };
    startTransition(() => {
      setShown(chosen);
      router[history](logsHref(chosen), { scroll: false });
    });
  }

  /** Holds what is typed, and sends it once typing pauses.
   *
   * @param next The box's text.
   */
  function search(next: string) {
    setText(next);
    setWaiting(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ ...shown, q: next }, "replace"), SEARCH_WAIT);
  }

  const filtered = isFiltered(shown);

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 min-[720px]:flex-wrap">
        <LogSearchField
          value={text}
          onChange={search}
          onClear={() => {
            setText("");
            apply({ ...shown, q: "" }, "replace");
          }}
        />
        {/* `contents` removes the wrapper's own box, so from 720px up the menus
            are items of the row itself and wrap with it. */}
        <div className="hidden min-[720px]:contents">
          <FilterMenu
            label="Level"
            icon={Funnel}
            choices={LOG_LEVELS}
            labels={LEVEL_LABELS}
            counts={page.levelCounts}
            selected={shown.level}
            onSelectedChange={(level) => apply({ ...shown, q: text, level })}
            focusTarget
          />
          <FilterMenu
            label="Source"
            icon={Server}
            choices={LOG_SOURCES}
            labels={SOURCE_LABELS}
            counts={page.sourceCounts}
            selected={shown.source}
            onSelectedChange={(source) => apply({ ...shown, q: text, source })}
          />
          <RangeMenu
            range={shown.range}
            onRangeChange={(range) => apply({ ...shown, q: text, range })}
          />
        </div>
        <LogFilterSheet
          page={page}
          filters={shown}
          onFiltersChange={(change) => apply({ ...shown, q: text, ...change })}
          className="min-[720px]:hidden"
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
              setText("");
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
