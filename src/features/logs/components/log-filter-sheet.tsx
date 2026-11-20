"use client";

import {
  FilterSheetFrame,
  OptionRow,
  SheetSection,
  summarise,
} from "@/src/shared/components/filter-sheet";
import type { LogPage } from "@/src/server/services/logs";
import {
  LOG_LEVELS,
  LOG_RANGES,
  LOG_SOURCES,
  type LogNarrowing,
} from "@/src/shared/lib/schemas/logs";
import { toggled } from "@/src/shared/lib/selection";
import { formatCount } from "@/src/features/logs/lib/log-format";

import { ANY_TIME, LEVEL_LABELS, RANGE_LABELS, SOURCE_LABELS, type LogLabel } from "./log-meta";

/** The filters the sheet holds, which is all but the search, which sits beside its button. */
type SheetFilters = Pick<LogNarrowing, "level" | "source" | "range">;

/** One filter's choices: a checkbox per choice, with its icon and how many entries it holds.
 *
 * The same choices, icons and counts as the filter's menu on a wider screen,
 * so a filter reads the same whichever form it takes.
 */
function ChoiceRows<T extends string>({
  choices,
  labels,
  counts,
  selected,
  onSelectedChange,
}: {
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
}) {
  const picked = new Set(selected);

  return (
    <>
      {choices.map((choice) => {
        const { label, Icon } = labels[choice];
        return (
          <OptionRow
            key={choice}
            type="checkbox"
            checked={picked.has(choice)}
            onChange={() => onSelectedChange([...toggled(picked, choice)])}
          >
            <Icon aria-hidden className="text-text-3 size-3.5 shrink-0" />
            <span>{label}</span>
            <span className="text-text-3 ml-auto text-xs tabular-nums">
              {formatCount(counts[choice])}
            </span>
          </OptionRow>
        );
      })}
    </>
  );
}

/** The Logs page's Level, Source and range filters behind one button, for screens too narrow to hold them beside the search box.
 *
 * Built on the same frame as the task list's sheet. The sections follow the
 * menus' order, and a change applies as the same pick from a menu does. The
 * badge counts each level and source picked, and one for a range; the search
 * is left out, since it is on the row beside the button.
 *
 * The button is marked as where clearing the filters sends focus, beside the
 * Level button: `focusFilters` picks whichever of the two is on screen.
 */
export function LogFilterSheet({
  page,
  filters,
  onFiltersChange,
  className,
}: {
  /** The page shown, whose counts each choice shows. */
  page: LogPage;
  /** The filters shown. */
  filters: SheetFilters;
  /** Called with the filters that change. */
  onFiltersChange: (change: Partial<SheetFilters>) => void;
  /** Classes for the button, such as when to hide it. */
  className?: string;
}) {
  const active = filters.level.length + filters.source.length + (filters.range === null ? 0 : 1);

  return (
    <FilterSheetFrame
      data-filter-focus-target=""
      label="Filters"
      title="Filters"
      active={active}
      onClear={() => onFiltersChange({ level: [], source: [], range: null })}
      className={className}
    >
      <SheetSection
        title="Level"
        summary={summarise(new Set(filters.level), (level) => LEVEL_LABELS[level].label)}
      >
        <ChoiceRows
          choices={LOG_LEVELS}
          labels={LEVEL_LABELS}
          counts={page.levelCounts}
          selected={filters.level}
          onSelectedChange={(level) => onFiltersChange({ level })}
        />
      </SheetSection>

      <SheetSection
        title="Source"
        summary={summarise(new Set(filters.source), (source) => SOURCE_LABELS[source].label)}
      >
        <ChoiceRows
          choices={LOG_SOURCES}
          labels={SOURCE_LABELS}
          counts={page.sourceCounts}
          selected={filters.source}
          onSelectedChange={(source) => onFiltersChange({ source })}
        />
      </SheetSection>

      <SheetSection
        title="Time range"
        summary={filters.range === null ? "" : RANGE_LABELS[filters.range]}
      >
        <fieldset>
          <legend className="sr-only">Time range</legend>
          <OptionRow
            type="radio"
            name="log-range"
            checked={filters.range === null}
            onChange={() => onFiltersChange({ range: null })}
          >
            {ANY_TIME}
          </OptionRow>
          {LOG_RANGES.map((range) => (
            <OptionRow
              key={range}
              type="radio"
              name="log-range"
              checked={filters.range === range}
              onChange={() => onFiltersChange({ range })}
            >
              {RANGE_LABELS[range]}
            </OptionRow>
          ))}
        </fieldset>
      </SheetSection>
    </FilterSheetFrame>
  );
}
