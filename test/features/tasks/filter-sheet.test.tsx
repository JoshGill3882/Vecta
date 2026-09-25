import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import type { TaskSort } from "@/src/features/tasks/lib/task-sort";
import { FilterSheet } from "@/src/features/tasks/components/toolbar/filter-sheet";

const categories: CategoryDTO[] = [
  { id: "c1", name: "Infrastructure", color: "#3b9eff", createdAt: "2026-09-01T00:00:00.000Z" },
  { id: "c2", name: "Frontend", color: "#e5545a", createdAt: "2026-09-01T00:00:00.000Z" },
];

/** Holds the selection and sort the way the task view does, so the sheet is
 * exercised through real state changes rather than asserted against a mock.
 *
 * @param props.initialSelected The categories selected on first render.
 * @param props.initialSort The order selected on first render.
 */
function Harness({
  initialSelected = new Set(),
  initialSort = "updated_desc",
}: {
  initialSelected?: ReadonlySet<string | null>;
  initialSort?: TaskSort;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const [sort, setSort] = useState(initialSort);
  return (
    <FilterSheet
      categories={categories}
      selectedCategoryIds={selected}
      onSelectedCategoryIdsChange={setSelected}
      sort={sort}
      onSortChange={setSort}
    />
  );
}

/** Opens the sheet from its button.
 *
 * @param user The user driving the test.
 * @returns The sheet's dialog element.
 */
async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Filter and sort/ }));
  return screen.findByRole("dialog", { name: "Filter and Sort" });
}

describe("FilterSheet button", () => {
  it("names no count while nothing is filtered", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Filter and sort" })).toBeDefined();
  });

  it("names the number of active filters", () => {
    render(<Harness initialSelected={new Set(["c1", null])} />);

    expect(screen.getByRole("button", { name: "Filter and sort, 2 active" })).toBeDefined();
  });

  // Sort reorders the list without hiding anything, so it is not a filter.
  it("does not count a non-default sort", () => {
    render(<Harness initialSort="title_asc" />);

    expect(screen.getByRole("button", { name: "Filter and sort" })).toBeDefined();
  });
});

describe("FilterSheet sheet", () => {
  it("opens with every section collapsed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const sheet = await openSheet(user);

    expect(within(sheet).getByRole("button", { name: /^Category/ })).toHaveProperty(
      "ariaExpanded",
      "false"
    );
    expect(within(sheet).getByRole("button", { name: /^Sort by/ })).toHaveProperty(
      "ariaExpanded",
      "false"
    );
    expect(within(sheet).queryByRole("checkbox")).toBeNull();
    expect(within(sheet).queryByRole("radio")).toBeNull();
  });

  it("applies a category as it is ticked and summarises the selection", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const sheet = await openSheet(user);

    await user.click(within(sheet).getByRole("button", { name: /^Category/ }));
    await user.click(within(sheet).getByRole("checkbox", { name: "Infrastructure" }));

    expect(within(sheet).getByRole("checkbox", { name: "Infrastructure" })).toHaveProperty(
      "checked",
      true
    );
    expect(within(sheet).getByRole("button", { name: "Category Infrastructure" })).toBeDefined();

    await user.click(within(sheet).getByRole("checkbox", { name: "Uncategorised" }));

    expect(within(sheet).getByRole("button", { name: "Category 2 selected" })).toBeDefined();
    // The button behind the sheet is hidden from the accessibility tree while the
    // sheet is modal, so it is found by its label rather than by role.
    expect(document.querySelector('[aria-label="Filter and sort, 2 active"]')).not.toBeNull();
  });

  it("changes the sort and shows the new order in the section header", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const sheet = await openSheet(user);

    expect(within(sheet).getByRole("button", { name: "Sort by Recently updated" })).toBeDefined();

    await user.click(within(sheet).getByRole("button", { name: /^Sort by/ }));
    await user.click(within(sheet).getByRole("radio", { name: "Title A-Z" }));

    expect(within(sheet).getByRole("radio", { name: "Title A-Z" })).toHaveProperty("checked", true);
    expect(within(sheet).getByRole("button", { name: "Sort by Title A-Z" })).toBeDefined();
  });

  it("clears every filter but leaves the sort alone", async () => {
    const user = userEvent.setup();
    render(<Harness initialSelected={new Set(["c1", "c2"])} initialSort="title_asc" />);
    const sheet = await openSheet(user);

    await user.click(within(sheet).getByRole("button", { name: "Clear filters" }));

    expect(within(sheet).getByRole("button", { name: /^Category$/ })).toBeDefined();
    expect(within(sheet).getByRole("button", { name: "Clear filters" })).toHaveProperty(
      "disabled",
      true
    );
    expect(within(sheet).getByRole("button", { name: "Sort by Title A-Z" })).toBeDefined();
  });

  it("returns focus to the button when Done closes it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const sheet = await openSheet(user);

    await user.click(within(sheet).getByRole("button", { name: "Done" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Filter and sort" }));
  });

  // Radix unmounts the sheet's content on close, taking the sections' open
  // state with it, so the sheet never reopens scrolled into a long list.
  it("reopens with its sections collapsed again", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    let sheet = await openSheet(user);
    await user.click(within(sheet).getByRole("button", { name: /^Category/ }));
    await user.click(within(sheet).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    sheet = await openSheet(user);

    expect(within(sheet).queryByRole("checkbox")).toBeNull();
  });
});
