import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { LogPage } from "@/src/server/services/logs";
import type { LogFilters } from "@/src/shared/lib/schemas/logs";
import { LogFilterBar } from "@/src/features/logs/components/log-filter-bar";

// There is no Next router in a test. Each navigation the bar asks for is
// recorded here, and a test that needs the server's answer re-renders with the
// filters that address would carry.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockReset();
});

const PAGE: LogPage = {
  entries: [],
  page: 1,
  pageCount: 1,
  matching: 1204,
  total: 1204,
  oldest: null,
  levelCounts: { debug: 3, info: 1180, warn: 12, error: 9 },
  sourceCounts: { auth: 40, tasks: 1100, categories: 50, system: 14 },
};

/** Filters for a test, with nothing picked unless it says.
 *
 * @param change The choices that differ from no filters.
 * @returns The filters.
 */
function filters(change: Partial<LogFilters> = {}): LogFilters {
  return { level: [], source: [], page: 1, ...change };
}

describe("LogFilterBar buttons", () => {
  it("offers a Level and a Source filter", () => {
    render(<LogFilterBar page={PAGE} filters={filters()} />);

    expect(screen.getByRole("button", { name: "Level" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Source" })).toBeDefined();
  });

  it("names how many choices each has picked", () => {
    render(
      <LogFilterBar page={PAGE} filters={filters({ level: ["warn", "error"], source: ["auth"] })} />
    );

    expect(screen.getByRole("button", { name: "Level, 2 selected" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Source, 1 selected" })).toBeDefined();
  });
});

describe("LogFilterBar menus", () => {
  it("lists every level, in order of severity, with how many entries it holds", async () => {
    const user = userEvent.setup();
    render(<LogFilterBar page={PAGE} filters={filters()} />);

    await user.click(screen.getByRole("button", { name: "Level" }));
    const options = await screen.findAllByRole("menuitemcheckbox");

    expect(options.map((option) => option.textContent)).toEqual([
      "Debug3",
      "Info1,180",
      "Warning12",
      "Error9",
    ]);
    for (const option of options) expect(option.getAttribute("aria-checked")).toBe("false");
  });

  it("lists every source with how many entries it holds", async () => {
    const user = userEvent.setup();
    render(<LogFilterBar page={PAGE} filters={filters()} />);

    await user.click(screen.getByRole("button", { name: "Source" }));
    const options = await screen.findAllByRole("menuitemcheckbox");

    expect(options.map((option) => option.textContent)).toEqual([
      "Auth40",
      "Tasks1,100",
      "Categories50",
      "System14",
    ]);
  });

  it("ticks the choices the URL carries", async () => {
    const user = userEvent.setup();
    render(<LogFilterBar page={PAGE} filters={filters({ level: ["error"] })} />);

    await user.click(screen.getByRole("button", { name: "Level, 1 selected" }));
    const error = await screen.findByRole("menuitemcheckbox", { name: /Error/ });

    expect(error.getAttribute("aria-checked")).toBe("true");
  });

  it("goes to the address for a picked level, back on the first page, without scrolling", async () => {
    const user = userEvent.setup();
    render(<LogFilterBar page={PAGE} filters={filters({ page: 4 })} />);

    await user.click(screen.getByRole("button", { name: "Level" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /Warning/ }));

    expect(push).toHaveBeenCalledWith("/logs?level=warn", { scroll: false });
  });

  it("keeps the other filter's choices when one changes", async () => {
    const user = userEvent.setup();
    render(<LogFilterBar page={PAGE} filters={filters({ source: ["auth"] })} />);

    await user.click(screen.getByRole("button", { name: "Level" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /Error/ }));

    expect(push).toHaveBeenCalledWith("/logs?level=error&source=auth", { scroll: false });
  });

  it("stays open, so a second choice adds to the first", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LogFilterBar page={PAGE} filters={filters()} />);

    await user.click(screen.getByRole("button", { name: "Level" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /Warning/ }));
    // The server answers with the new filters.
    rerender(<LogFilterBar page={PAGE} filters={filters({ level: ["warn"] })} />);
    await user.click(screen.getByRole("menuitemcheckbox", { name: /Error/ }));

    expect(push).toHaveBeenLastCalledWith("/logs?level=warn&level=error", { scroll: false });
  });

  it("takes a ticked choice away when it is picked again", async () => {
    const user = userEvent.setup();
    render(<LogFilterBar page={PAGE} filters={filters({ level: ["warn", "error"] })} />);

    await user.click(screen.getByRole("button", { name: "Level, 2 selected" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /Warning/ }));

    expect(push).toHaveBeenCalledWith("/logs?level=error", { scroll: false });
  });

  it("offers to clear a filter only once it has a choice", async () => {
    const user = userEvent.setup();
    render(<LogFilterBar page={PAGE} filters={filters({ source: ["tasks"] })} />);

    await user.click(screen.getByRole("button", { name: "Level" }));
    const levelMenu = await screen.findByRole("menu");
    expect(within(levelMenu).queryByRole("menuitem", { name: "Clear level" })).toBeNull();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Source, 1 selected" }));
    await user.click(await screen.findByRole("menuitem", { name: "Clear source" }));

    expect(push).toHaveBeenCalledWith("/logs", { scroll: false });
  });
});

describe("LogFilterBar summary", () => {
  it("says nothing while no filter is on", () => {
    render(<LogFilterBar page={PAGE} filters={filters()} />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("says how many entries the filters match, of how many", () => {
    render(
      <LogFilterBar
        page={{ ...PAGE, matching: 21 }}
        filters={filters({ level: ["warn", "error"] })}
      />
    );

    expect(screen.getByRole("status").textContent).toBe("21 of 1,204 entries");
  });

  it("marks only the Level button as where clearing sends focus", () => {
    render(<LogFilterBar page={PAGE} filters={filters()} />);

    expect(
      screen.getByRole("button", { name: "Level" }).hasAttribute("data-filter-focus-target")
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Source" }).hasAttribute("data-filter-focus-target")
    ).toBe(false);
  });

  // The mark is a data attribute, not an id: the menu names itself by its
  // button's id, which an id of our own would replace.
  it("keeps the open menu named by its button", async () => {
    const user = userEvent.setup();
    render(<LogFilterBar page={PAGE} filters={filters()} />);

    await user.click(screen.getByRole("button", { name: "Level" }));

    expect(await screen.findByRole("menu", { name: "Level" })).toBeDefined();
  });

  it("clears both filters, sending focus to the Level button", async () => {
    const user = userEvent.setup();
    render(
      <LogFilterBar page={PAGE} filters={filters({ level: ["error"], source: ["system"] })} />
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(push).toHaveBeenCalledWith("/logs", { scroll: false });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Level, 1 selected" }));
  });
});
