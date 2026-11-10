import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { DueBucket } from "@/src/features/tasks/lib/due-date";
import { DueFilter } from "@/src/features/tasks/components/toolbar/due-filter";

/** Holds the selection the way the task view does, so the menu is exercised
 * through real state changes rather than asserted against a mock.
 *
 * @param props.initialSelected The options selected on first render.
 */
function Harness({ initialSelected = new Set() }: { initialSelected?: ReadonlySet<DueBucket> }) {
  const [selected, setSelected] = useState(initialSelected);
  return <DueFilter selected={selected} onSelectedChange={setSelected} />;
}

describe("DueFilter button", () => {
  it("is named Due while nothing is selected", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Due" })).toBeDefined();
  });

  it("names how many options are selected", () => {
    render(<Harness initialSelected={new Set(["overdue", "today"])} />);

    expect(screen.getByRole("button", { name: "Due, 2 selected" })).toBeDefined();
  });
});

describe("DueFilter menu", () => {
  it("offers the four options in order, none ticked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Due" }));
    const options = await screen.findAllByRole("menuitemcheckbox");

    expect(options.map((option) => option.textContent)).toEqual([
      "Overdue",
      "Due today",
      "Next 7 days",
      "No due date",
    ]);
    for (const option of options) expect(option.getAttribute("aria-checked")).toBe("false");
  });

  it("ticks options as they are picked and stays open for the next", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Due" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Overdue" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "No due date" }));

    expect(
      screen.getByRole("menuitemcheckbox", { name: "Overdue" }).getAttribute("aria-checked")
    ).toBe("true");
    expect(
      screen.getByRole("menuitemcheckbox", { name: "No due date" }).getAttribute("aria-checked")
    ).toBe("true");
    // The menu is modal, so the button behind it is found by its text.
    expect(document.querySelector("[aria-haspopup]")?.textContent).toContain("2 selected");
  });

  it("unticks an option picked a second time", async () => {
    const user = userEvent.setup();
    render(<Harness initialSelected={new Set(["today"])} />);

    await user.click(screen.getByRole("button", { name: "Due, 1 selected" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Due today" }));

    expect(
      screen.getByRole("menuitemcheckbox", { name: "Due today" }).getAttribute("aria-checked")
    ).toBe("false");
  });

  it("offers Clear due date only while something is selected", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Due" }));
    await screen.findAllByRole("menuitemcheckbox");

    expect(screen.queryByRole("menuitem", { name: "Clear due date" })).toBeNull();
  });

  it("clears every option and closes", async () => {
    const user = userEvent.setup();
    render(<Harness initialSelected={new Set(["overdue", "week"])} />);

    await user.click(screen.getByRole("button", { name: "Due, 2 selected" }));
    await user.click(await screen.findByRole("menuitem", { name: "Clear due date" }));

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Due" })).toBeDefined();
  });

  it("works from the keyboard alone", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole("button", { name: "Due" }).focus();
    await user.keyboard("{Enter}");
    // Radix focuses the first option when a menu is opened from the keyboard.
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(
      screen.getByRole("menuitemcheckbox", { name: "Due today" }).getAttribute("aria-checked")
    ).toBe("true");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Due, 1 selected" })).toBe(document.activeElement);
  });
});
