import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import { ActiveFilters } from "@/src/features/tasks/components/toolbar/active-filters";
import { tasksSearchFieldId } from "@/src/features/tasks/components/toolbar/search-field";
import type { TaskNarrowingState } from "@/src/features/tasks/hooks/use-task-narrowing";
import type { DueBucket } from "@/src/features/tasks/lib/due-date";
import { isNarrowing, normaliseQuery } from "@/src/features/tasks/lib/task-search";

const categories: CategoryDTO[] = [
  { id: "c1", name: "Infrastructure", color: "#3b9eff", createdAt: "2026-09-01T00:00:00.000Z" },
  { id: "c2", name: "Frontend", color: "#e5545a", createdAt: "2026-09-01T00:00:00.000Z" },
];

/** Holds the narrowing state the way the task view's hook does, starting from
 * any selection, so the row is exercised through real state changes. A search
 * field stands in for the toolbar's, as the place focus returns to.
 *
 * @param props.query The query on first render.
 * @param props.due The due-date options selected on first render.
 * @param props.categoryIds The categories selected on first render.
 */
function Harness({
  query: initialQuery = "",
  due: initialDue = new Set(),
  categoryIds: initialCategoryIds = new Set(),
}: {
  query?: string;
  due?: ReadonlySet<DueBucket>;
  categoryIds?: ReadonlySet<string | null>;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [dueBuckets, setDueBuckets] = useState(initialDue);
  const [categoryIds, setCategoryIds] = useState(initialCategoryIds);
  const narrowing = { needle: normaliseQuery(query), categoryIds, dueBuckets };

  const state: TaskNarrowingState = {
    query,
    setQuery,
    categoryIds,
    setCategoryIds,
    dueBuckets,
    setDueBuckets,
    narrowing,
    narrowed: isNarrowing(narrowing),
    clear: () => {
      setQuery("");
      setCategoryIds(new Set());
      setDueBuckets(new Set());
    },
  };

  return (
    <>
      <input id={tasksSearchFieldId} aria-label="Search tasks" />
      <ActiveFilters narrowing={state} categories={categories} />
    </>
  );
}

/** The chips' visible names, in the order the row shows them. */
function chipNames() {
  const list = screen.getByRole("list", { name: "Active filters" });
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

describe("ActiveFilters", () => {
  it("renders nothing while nothing narrows the list", () => {
    render(<Harness query="   " />);

    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
  });

  it("shows the search, then due-date options, then categories, in the menus' order", () => {
    render(
      <Harness
        query="  login "
        due={new Set(["none", "overdue"])}
        categoryIds={new Set([null, "c2", "c1"])}
      />
    );

    expect(chipNames()).toEqual([
      "“login”",
      "Overdue",
      "No due date",
      "Infrastructure",
      "Frontend",
      "Uncategorised",
    ]);
  });

  it("names what each remove button removes", () => {
    render(<Harness query="login" due={new Set(["today"])} categoryIds={new Set(["c1", null])} />);

    expect(screen.getByRole("button", { name: "Remove search “login”" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Remove Due today filter" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Remove Infrastructure filter" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Remove Uncategorised filter" })).toBeDefined();
  });

  // The colour is per-category data, so it is an inline style rather than a
  // class; the dot is the one cue that survives a colour too dark to read.
  it("fills a category chip's dot with the category's colour", () => {
    render(<Harness categoryIds={new Set(["c1"])} />);

    const chip = screen.getByText("Infrastructure").closest("li");
    const dot = chip?.querySelector("span");
    expect(dot?.style.backgroundColor).toBe("rgb(59, 158, 255)");
  });

  it("removes only the chip pressed and moves focus to its neighbour", async () => {
    const user = userEvent.setup();
    render(<Harness due={new Set(["overdue", "week"])} categoryIds={new Set(["c1"])} />);

    await user.click(screen.getByRole("button", { name: "Remove Next 7 days filter" }));

    expect(chipNames()).toEqual(["Overdue", "Infrastructure"]);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Remove Infrastructure filter" })
    );
  });

  it("moves focus to the previous chip when the last one is removed", async () => {
    const user = userEvent.setup();
    render(<Harness due={new Set(["overdue"])} categoryIds={new Set(["c1"])} />);

    await user.click(screen.getByRole("button", { name: "Remove Infrastructure filter" }));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Remove Overdue filter" })
    );
  });

  it("removes the search chip by clearing the query", async () => {
    const user = userEvent.setup();
    render(<Harness query="login" due={new Set(["today"])} />);

    await user.click(screen.getByRole("button", { name: "Remove search “login”" }));

    expect(chipNames()).toEqual(["Due today"]);
  });

  it("goes away with the only chip, returning focus to the search field", async () => {
    const user = userEvent.setup();
    render(<Harness due={new Set(["overdue"])} />);

    await user.click(screen.getByRole("button", { name: "Remove Overdue filter" }));

    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search tasks" }));
  });

  it("clears everything at once, returning focus to the search field", async () => {
    const user = userEvent.setup();
    render(
      <Harness query="login" due={new Set(["overdue"])} categoryIds={new Set(["c1", null])} />
    );

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search tasks" }));
  });
});
