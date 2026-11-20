import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { LogPage } from "@/src/server/services/logs";
import type { LogNarrowing } from "@/src/shared/lib/schemas/logs";
import { LogFilterSheet } from "@/src/features/logs/components/log-filter-sheet";

const PAGE: LogPage = {
  entries: [],
  page: 1,
  pageCount: 1,
  matching: 1204,
  total: 1204,
  oldest: null,
  levelCounts: { debug: 3, info: 1180, warn: 12, error: 9 },
  sourceCounts: { auth: 40, tasks: 1100, categories: 50, system: 14 },
  readAt: "2026-11-17T19:30:00.000Z",
};

/** The sheet's filters for a test, with nothing picked unless it says.
 *
 * @param change The filters that differ from none.
 * @returns The filters.
 */
function filters(
  change: Partial<Pick<LogNarrowing, "level" | "source" | "range">> = {}
): Pick<LogNarrowing, "level" | "source" | "range"> {
  return { level: [], source: [], range: null, ...change };
}

/** Opens the sheet from its button.
 *
 * @param user The user driving the test.
 * @returns The sheet.
 */
async function openSheet(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: /^Filters/ }));
  return screen.findByRole("dialog", { name: "Filters" });
}

/** Opens one of the sheet's sections.
 *
 * @param user The user driving the test.
 * @param sheet The open sheet.
 * @param title The section's title, such as `Level`.
 */
async function openSection(
  user: ReturnType<typeof userEvent.setup>,
  sheet: HTMLElement,
  title: string
) {
  await user.click(within(sheet).getByRole("button", { name: new RegExp(`^${title}`) }));
}

describe("LogFilterSheet button", () => {
  it("is named Filters, outlined, with no badge while no filter is on", () => {
    render(<LogFilterSheet page={PAGE} filters={filters()} onFiltersChange={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Filters" });
    expect(button.getAttribute("data-variant")).toBe("outline");
    expect(button.textContent).toBe("");
  });

  it("counts each level and source picked, and one for a range", () => {
    render(
      <LogFilterSheet
        page={PAGE}
        filters={filters({ level: ["warn", "error"], source: ["auth"], range: "7d" })}
        onFiltersChange={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: "Filters, 4 active" });
    expect(button.getAttribute("data-variant")).toBe("secondary");
    expect(button.textContent).toBe("4");
  });

  it("is marked as where clearing the filters sends focus", () => {
    render(<LogFilterSheet page={PAGE} filters={filters()} onFiltersChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Filters" }).hasAttribute("data-filter-focus-target")
    ).toBe(true);
  });

  it("takes the classes it is given", () => {
    render(
      <LogFilterSheet
        page={PAGE}
        filters={filters()}
        onFiltersChange={vi.fn()}
        className="min-[720px]:hidden"
      />
    );

    expect(screen.getByRole("button", { name: "Filters" }).className).toContain(
      "min-[720px]:hidden"
    );
  });
});

describe("LogFilterSheet sheet", () => {
  it("is titled Filters, with Level, Source and Time range in the menus' order", async () => {
    const user = userEvent.setup();
    render(<LogFilterSheet page={PAGE} filters={filters()} onFiltersChange={vi.fn()} />);

    const sheet = await openSheet(user);

    expect(
      within(sheet)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent)
    ).toEqual(["Level ", "Source ", "Time range "]);
  });

  it("names what each section has picked in its header", async () => {
    const user = userEvent.setup();
    render(
      <LogFilterSheet
        page={PAGE}
        filters={filters({ level: ["warn"], source: ["auth", "tasks"], range: "30d" })}
        onFiltersChange={vi.fn()}
      />
    );

    const sheet = await openSheet(user);

    expect(
      within(sheet)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent)
    ).toEqual(["Level Warning", "Source 2 selected", "Time range Last 30 days"]);
  });

  it("lists each level with its icon and how many entries it holds, ticking those picked", async () => {
    const user = userEvent.setup();
    render(
      <LogFilterSheet
        page={PAGE}
        filters={filters({ level: ["error"] })}
        onFiltersChange={vi.fn()}
      />
    );

    const sheet = await openSheet(user);
    await openSection(user, sheet, "Level");
    const boxes = within(sheet).getAllByRole("checkbox");

    expect(boxes.map((box) => box.closest("label")?.textContent)).toEqual([
      "Debug3",
      "Info1,180",
      "Warning12",
      "Error9",
    ]);
    expect(boxes.map((box) => (box as HTMLInputElement).checked)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(boxes[0].closest("label")?.querySelector("svg")).not.toBeNull();
  });

  it("lists each source with how many entries it holds", async () => {
    const user = userEvent.setup();
    render(<LogFilterSheet page={PAGE} filters={filters()} onFiltersChange={vi.fn()} />);

    const sheet = await openSheet(user);
    await openSection(user, sheet, "Source");

    expect(
      within(sheet)
        .getAllByRole("checkbox")
        .map((box) => box.closest("label")?.textContent)
    ).toEqual(["Auth40", "Tasks1,100", "Categories50", "System14"]);
  });

  it("adds a level to those picked, and takes a picked one away", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <LogFilterSheet
        page={PAGE}
        filters={filters({ level: ["warn"] })}
        onFiltersChange={onFiltersChange}
      />
    );

    const sheet = await openSheet(user);
    await openSection(user, sheet, "Level");
    await user.click(within(sheet).getByRole("checkbox", { name: /Error/ }));
    await user.click(within(sheet).getByRole("checkbox", { name: /Warning/ }));

    expect(onFiltersChange).toHaveBeenNthCalledWith(1, { level: ["warn", "error"] });
    expect(onFiltersChange).toHaveBeenNthCalledWith(2, { level: [] });
  });

  it("changes the sources picked", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<LogFilterSheet page={PAGE} filters={filters()} onFiltersChange={onFiltersChange} />);

    const sheet = await openSheet(user);
    await openSection(user, sheet, "Source");
    await user.click(within(sheet).getByRole("checkbox", { name: /System/ }));

    expect(onFiltersChange).toHaveBeenCalledWith({ source: ["system"] });
  });

  it("offers Any time and each range as radio buttons, with the one on checked", async () => {
    const user = userEvent.setup();
    render(
      <LogFilterSheet page={PAGE} filters={filters({ range: "24h" })} onFiltersChange={vi.fn()} />
    );

    const sheet = await openSheet(user);
    await openSection(user, sheet, "Time range");
    const radios = within(within(sheet).getByRole("group", { name: "Time range" })).getAllByRole(
      "radio"
    );

    expect(radios.map((radio) => radio.closest("label")?.textContent)).toEqual([
      "Any time",
      "Last 24 hours",
      "Last 7 days",
      "Last 30 days",
    ]);
    expect(radios.map((radio) => (radio as HTMLInputElement).checked)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it("checks Any time while no range is on", async () => {
    const user = userEvent.setup();
    render(<LogFilterSheet page={PAGE} filters={filters()} onFiltersChange={vi.fn()} />);

    const sheet = await openSheet(user);
    await openSection(user, sheet, "Time range");

    expect(
      (within(sheet).getByRole("radio", { name: "Any time" }) as HTMLInputElement).checked
    ).toBe(true);
  });

  it("picks a range, and takes it away with Any time", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const { rerender } = render(
      <LogFilterSheet page={PAGE} filters={filters()} onFiltersChange={onFiltersChange} />
    );

    const sheet = await openSheet(user);
    await openSection(user, sheet, "Time range");
    await user.click(within(sheet).getByRole("radio", { name: "Last 7 days" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ range: "7d" });

    // The page answers with the range on.
    rerender(
      <LogFilterSheet
        page={PAGE}
        filters={filters({ range: "7d" })}
        onFiltersChange={onFiltersChange}
      />
    );
    await user.click(within(sheet).getByRole("radio", { name: "Any time" }));

    expect(onFiltersChange).toHaveBeenLastCalledWith({ range: null });
  });

  it("stays open as the filters change", async () => {
    const user = userEvent.setup();
    render(<LogFilterSheet page={PAGE} filters={filters()} onFiltersChange={vi.fn()} />);

    const sheet = await openSheet(user);
    await openSection(user, sheet, "Level");
    await user.click(within(sheet).getByRole("checkbox", { name: /Info/ }));

    expect(screen.getByRole("dialog", { name: "Filters" })).toBe(sheet);
  });

  it("clears the levels, sources and range with its Clear filters", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <LogFilterSheet
        page={PAGE}
        filters={filters({ level: ["info"], range: "30d" })}
        onFiltersChange={onFiltersChange}
      />
    );

    const sheet = await openSheet(user);
    await user.click(within(sheet).getByRole("button", { name: "Clear filters" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ level: [], source: [], range: null });
  });

  it("disables its Clear filters while no filter is on", async () => {
    const user = userEvent.setup();
    render(<LogFilterSheet page={PAGE} filters={filters()} onFiltersChange={vi.fn()} />);

    const sheet = await openSheet(user);

    expect(
      within(sheet).getByRole("button", { name: "Clear filters" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("closes with Done", async () => {
    const user = userEvent.setup();
    render(<LogFilterSheet page={PAGE} filters={filters()} onFiltersChange={vi.fn()} />);

    const sheet = await openSheet(user);
    await user.click(within(sheet).getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
