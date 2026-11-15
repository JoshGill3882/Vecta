"use client";

import Link from "next/link";

import { Button } from "@/src/shared/components/ui/button";

import { focusFilters } from "./log-filter-bar";

/** The empty state's Clear filters: a link to the unfiltered log that sends focus to the filters first.
 *
 * The link disappears with the empty state once the filters are cleared. Left
 * alone, focus would stay where it was, and the next Tab would land on the
 * first entry. Sending it to the filters matches the filter bar's own Clear
 * filters, and leaves the reader where they can filter again.
 */
export function ClearFiltersLink() {
  return (
    <Button variant="outline" asChild>
      <Link href="/logs" onClick={focusFilters}>
        Clear filters
      </Link>
    </Button>
  );
}
