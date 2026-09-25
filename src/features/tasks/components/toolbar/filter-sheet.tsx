"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/src/shared/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/src/shared/components/ui/collapsible";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/src/shared/components/ui/sheet";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import { cn } from "@/src/shared/lib/utils";
import { toggled } from "@/src/features/tasks/lib/selection";
import { TASK_SORTS, type TaskSort } from "@/src/features/tasks/lib/task-sort";

/** `null` is the Uncategorised option, matching how a task stores its absence. */
type Selection = ReadonlySet<string | null>;

/** Summarises a selection for a collapsed section's header.
 *
 * @param selection The selected option.
 * @param labelOf Names one option.
 * @returns Nothing for an inactive filter, the options's name for one, a count for several.
 */
function summarise<T>(selection: ReadonlySet<T>, labelOf: (id: T) => string) {
  if (selection.size === 0) return "";
  if (selection.size === 1) return labelOf([...selection][0]);
  return `${selection.size} selected`;
}

/** One collapsible section of the sheet: a header row that opens its options.
 *
 * Uncontrolled, so each section starts closed every time the sheet opens -
 * Radix unmounts the sheet's content on close, and the state goes with it.
 */
function SheetSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <Collapsible className="border-border-faint border-b">
      <h3>
        <CollapsibleTrigger className="group hover:bg-surface-3/60 focus-visible:ring-ring flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left outline-none focus-visible:ring-2">
          <span className="text-foreground text-[14.5px] font-semibold tracking-[-0.01em]">
            {title}
          </span>{" "}
          <span className="text-primary min-w-0 flex-1 truncate text-right text-[13,5px]">
            {summary}
          </span>
          <ChevronDown className="text-text-3 size-4 shrink-0 transition-transform duration-[180ms] group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent className="pb-1.5">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** A tappable option row wrapping a real checkbox or radio.
 *
 * The native input is visually hidden but kept: it brings Space to toggle, arrow
 * keys between radios, and the checked state a screen reader announces, none of
 * which a styled button would have without rebuilding them by hand.
 */
function OptionRow({
  type,
  name,
  checked,
  onChange,
  children,
}: {
  type: "checkbox" | "radio";
  name?: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="text-text-2 hover:bg-surface-3 has-focus-visible:bg-surface-3 has-focus-visible:ring-ring flex min-h-11 cursor-pointer items-center gap-[9px] rounded-[7px] px-2.5 text-[13.5px] transition-colors has-checked:text-foreground has-focus-visible:ring-2">
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {type === "checkbox" ? (
        <span
          aria-hidden
          className={cn(
            "flex size-[15px] shrink-0 items-center justify-center rounded-[4px] border",
            checked ? "border-primary bg-primary text-white" : "border-border-strong"
          )}
        >
          {checked && <Check className="size-[11px]" />}
        </span>
      ) : (
        <span
          aria-hidden
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border",
            checked ? "border-primary" : "border-border-strong"
          )}
        >
          {checked && <span className="bg-primary size-2 rounded-full" />}
        </span>
      )}
      {children}
    </label>
  );
}

/**
 * Every filter and the sort order behind one button, for screens too narrow to
 * hold them in a row.
 *
 * Changes apply as they are made rather than on Done: the list is right there
 * behind the sheet, and an Apply step would leave the badge and the list out of
 * step with the checkboxes until it was pressed.
 *
 * Each section collapses, and all start closed, so however many categories
 * exist the sheet opens as one short row per section, with Sort by never
 * pushed below a long list. Section order matches the desktop toolbar.
 */
export function FilterSheet({
  categories,
  selectedCategoryIds,
  onSelectedCategoryIdsChange,
  sort,
  onSortChange,
  className,
}: {
  categories: CategoryDTO[];
  selectedCategoryIds: Selection;
  onSelectedCategoryIdsChange: (next: Selection) => void;
  sort: TaskSort;
  onSortChange: (sort: TaskSort) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // Sort is left out: it reorders the list rather than narrowing it, so it
  // never hides anything a reader would need the badge to explain.
  const active = selectedCategoryIds.size;

  /** Names a selected category, or Uncategorised for `null`.
   *
   * @param id The selected option.
   * @returns Its display name.
   */
  function categoryName(id: string | null) {
    if (id === null) return "Uncategorised";
    return categories.find((category) => category.id === id)?.name ?? "";
  }

  const sortLabel = (TASK_SORTS.find((option) => option.id === sort) ?? TASK_SORTS[0]).label;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant={active > 0 ? "secondary" : "outline"}
        size="icon-lg"
        aria-label={active > 0 ? `Filter and sort, ${active} active` : "Filter and sort"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn("relative", className)}
      >
        <SlidersHorizontal className="size-4" />
        {active > 0 && (
          <span
            aria-hidden
            className="bg-primary ring-background absolute -top-1.5 -right-1.5 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-[5px] text-[11px] font-semibold text-white ring-2"
          >
            {active}
          </span>
        )}
      </Button>

      <SheetContent
        side="bottom"
        showCloseButton={false}
        // The sheet has a title and no prose description; Radix only stops
        // warning about the missing `aria-describedby` when it is cleared.
        aria-describedby={undefined}
        className="mx-auto max-h-[85dvh] max-w-[560px] gap-0 rounded-t-2xl"
      >
        {/* A visual cue that this is a sheet; swipe to dismiss is not wired. */}
        <div aria-hidden className="flex justify-center pt-2 pb-0.5">
          <span className="bg-border-strong h-1 w-9 rounded-full" />
        </div>

        <div className="flex items-center justify-between border-b pt-1.5 pr-3 pb-2.5 pl-[18px]">
          <SheetTitle className="text-base font-semibold tracking-[0.01em]">
            Filter and Sort
          </SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-lg" aria-label="Close" className="text-text-3">
              <X className="size-[18px]" />
            </Button>
          </SheetClose>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-2.5 pb-2.5">
          <SheetSection title="Category" summary={summarise(selectedCategoryIds, categoryName)}>
            {categories.map((category) => (
              <OptionRow
                key={category.id}
                type="checkbox"
                checked={selectedCategoryIds.has(category.id)}
                onChange={() =>
                  onSelectedCategoryIdsChange(toggled(selectedCategoryIds, category.id))
                }
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="truncate">{category.name}</span>
              </OptionRow>
            ))}
            <OptionRow
              type="checkbox"
              checked={selectedCategoryIds.has(null)}
              onChange={() => onSelectedCategoryIdsChange(toggled(selectedCategoryIds, null))}
            >
              <span className="border-text-faint size-2 shrink-0 rounded-full border border-dashed" />
              <span className="truncate">Uncategorised</span>
            </OptionRow>
          </SheetSection>

          <SheetSection title="Sort by" summary={sortLabel}>
            <fieldset>
              <legend className="sr-only">Sort by</legend>
              {TASK_SORTS.map((option) => (
                <OptionRow
                  key={option.id}
                  type="radio"
                  name="task-sort"
                  checked={sort === option.id}
                  onChange={() => onSortChange(option.id)}
                >
                  {option.label}
                </OptionRow>
              ))}
            </fieldset>
          </SheetSection>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={active === 0}
            onClick={() => onSelectedCategoryIdsChange(new Set())}
          >
            Clear filters
          </Button>
          <SheetClose asChild>
            <Button type="button" className="h-11 max-w-[125px] flex-1">
              Done
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
