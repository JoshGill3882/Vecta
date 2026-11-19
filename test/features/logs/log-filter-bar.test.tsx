import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { LogPage } from "@/src/server/services/logs";
import type { LogFilters } from "@/src/shared/lib/schemas/logs";
import { LogFilterBar } from "@/src/features/logs/components/log-filter-bar";

// There is no Next router in a test. Each navigation the bar asks for is
// recorded here, and a test that needs the server's answer re-renders with the
// filters that address would carry.
const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
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
  readAt: "2026-11-17T19:30:00.000Z",
};

/** Filters for a test, with nothing picked unless it says.
 *
 * @param change The choices that differ from no filters.
 * @returns The filters.
 */
function filters(change: Partial<LogFilters> = {}): LogFilters {
  return { q: "", level: [], source: [], range: null, page: 1, ...change };
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

  it("keeps the search and the range when a choice changes", async () => {
    const user = userEvent.setup();
    render(<LogFilterBar page={PAGE} filters={filters({ q: "milk", range: "7d", page: 3 })} />);

    await user.click(screen.getByRole("button", { name: "Source" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /Tasks/ }));

    expect(push).toHaveBeenCalledWith("/logs?q=milk&source=tasks&range=7d", { scroll: false });
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

  it.each([
    ["a search", { q: "milk" }],
    ["a range", { range: "30d" as const }],
  ])("says how many entries match with only %s on", (_, change) => {
    render(<LogFilterBar page={{ ...PAGE, matching: 3 }} filters={filters(change)} />);

    expect(screen.getByRole("status").textContent).toBe("3 of 1,204 entries");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeDefined();
  });

  it("clears the search and the range with the other filters", async () => {
    const user = userEvent.setup();
    render(
      <LogFilterBar
        page={PAGE}
        filters={filters({ q: "milk", level: ["warn"], range: "24h", page: 2 })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(push).toHaveBeenCalledWith("/logs", { scroll: false });
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

describe("LogFilterBar search", () => {
  // The search waits for typing to pause, so these tests move the clock on
  // themselves rather than wait for it.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Sets up a user whose typing keeps pace with the test's clock.
   *
   * @returns The user.
   */
  function typist() {
    return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  }

  /** Moves the clock past the search's wait. */
  function pause() {
    act(() => {
      vi.advanceTimersByTime(300);
    });
  }

  /** The search box.
   *
   * @returns The box.
   */
  function box(): HTMLInputElement {
    return screen.getByRole("searchbox", { name: "Search log entries" });
  }

  it("shows the search the URL carries, and takes no more than 200 characters", () => {
    render(<LogFilterBar page={PAGE} filters={filters({ q: "milk" })} />);

    expect(box().value).toBe("milk");
    expect(box().maxLength).toBe(200);
  });

  it("sends the search once typing pauses, replacing the address, back on the first page", async () => {
    const user = typist();
    render(<LogFilterBar page={PAGE} filters={filters({ level: ["warn"], page: 3 })} />);

    await user.type(box(), "milk");
    expect(replace).not.toHaveBeenCalled();
    pause();

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/logs?q=milk&level=warn", { scroll: false });
    expect(push).not.toHaveBeenCalled();
  });

  it("waits again with each keystroke, so a word typed at speed is one search", async () => {
    const user = typist();
    render(<LogFilterBar page={PAGE} filters={filters()} />);

    await user.type(box(), "mi");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await user.type(box(), "lk");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(replace).not.toHaveBeenCalled();
    pause();

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/logs?q=milk", { scroll: false });
  });

  it("offers a clear button only once there is a search", async () => {
    const user = typist();
    render(<LogFilterBar page={PAGE} filters={filters()} />);

    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    await user.type(box(), "m");

    expect(screen.getByRole("button", { name: "Clear search" })).toBeDefined();
  });

  it("clears the search at once with the clear button, leaving focus in the box", async () => {
    const user = typist();
    render(<LogFilterBar page={PAGE} filters={filters({ q: "milk", source: ["tasks"] })} />);

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(replace).toHaveBeenCalledWith("/logs?source=tasks", { scroll: false });
    expect(box().value).toBe("");
    expect(document.activeElement).toBe(box());
  });

  it("clears the search with Escape", async () => {
    const user = typist();
    render(<LogFilterBar page={PAGE} filters={filters({ q: "milk" })} />);

    await user.click(box());
    await user.keyboard("{Escape}");

    expect(replace).toHaveBeenCalledWith("/logs", { scroll: false });
    expect(box().value).toBe("");
  });

  it("sends a waiting search with a filter picked meanwhile, and only once", async () => {
    const user = typist();
    render(<LogFilterBar page={PAGE} filters={filters()} />);

    await user.type(box(), "milk");
    await user.click(screen.getByRole("button", { name: "Level" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /Warning/ }));
    pause();

    expect(push).toHaveBeenCalledWith("/logs?q=milk&level=warn", { scroll: false });
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a waiting search with a range picked meanwhile", async () => {
    const user = typist();
    render(<LogFilterBar page={PAGE} filters={filters()} />);

    await user.type(box(), "milk");
    await user.click(screen.getByRole("button", { name: "Time range, Any time" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Last 7 days" }));
    pause();

    expect(push).toHaveBeenCalledWith("/logs?q=milk&range=7d", { scroll: false });
    expect(replace).not.toHaveBeenCalled();
  });

  it("empties the box when the filters are cleared", async () => {
    const user = typist();
    render(<LogFilterBar page={PAGE} filters={filters({ q: "milk" })} />);

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(box().value).toBe("");
  });

  it("follows the search when the address changes it, as the back button does", () => {
    const { rerender } = render(<LogFilterBar page={PAGE} filters={filters({ q: "milk" })} />);

    rerender(<LogFilterBar page={PAGE} filters={filters({ q: "eggs" })} />);

    expect(box().value).toBe("eggs");
  });

  it("keeps a space typed after a word when that word's search arrives", async () => {
    const user = typist();
    const { rerender } = render(<LogFilterBar page={PAGE} filters={filters()} />);

    await user.type(box(), "buy ");
    pause();
    expect(replace).toHaveBeenCalledWith("/logs?q=buy", { scroll: false });
    // The server answers with the search trimmed.
    rerender(<LogFilterBar page={PAGE} filters={filters({ q: "buy" })} />);

    expect(box().value).toBe("buy ");
  });

  it("keeps what is typed after a search is sent when that search arrives", async () => {
    const user = typist();
    const { rerender } = render(<LogFilterBar page={PAGE} filters={filters()} />);

    await user.type(box(), "milk");
    pause();
    await user.type(box(), "y");
    rerender(<LogFilterBar page={PAGE} filters={filters({ q: "milk" })} />);

    expect(box().value).toBe("milky");
  });
});

describe("LogFilterBar range", () => {
  it("reads Any time while no range is on, named as the time range", () => {
    render(<LogFilterBar page={PAGE} filters={filters()} />);

    const button = screen.getByRole("button", { name: "Time range, Any time" });
    expect(button.textContent).toBe("Any time");
    expect(button.getAttribute("data-variant")).toBe("outline");
  });

  it("names the range picked on its button", () => {
    render(<LogFilterBar page={PAGE} filters={filters({ range: "7d" })} />);

    const button = screen.getByRole("button", { name: "Time range, Last 7 days" });
    expect(button.getAttribute("data-variant")).toBe("secondary");
  });

  it("lists Any time and each range, with the one on checked", async () => {
    const user = userEvent.setup();
    render(<LogFilterBar page={PAGE} filters={filters({ range: "24h" })} />);

    await user.click(screen.getByRole("button", { name: "Time range, Last 24 hours" }));
    const options = await screen.findAllByRole("menuitemradio");

    expect(options.map((option) => option.textContent)).toEqual([
      "Any time",
      "Last 24 hours",
      "Last 7 days",
      "Last 30 days",
    ]);
    expect(options.map((option) => option.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
      "false",
    ]);
  });

  it("goes to the address for a picked range, keeping the other filters, and closes", async () => {
    const user = userEvent.setup();
    render(
      <LogFilterBar page={PAGE} filters={filters({ q: "milk", level: ["error"], page: 2 })} />
    );

    await user.click(screen.getByRole("button", { name: "Time range, Any time" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Last 30 days" }));

    expect(push).toHaveBeenCalledWith("/logs?q=milk&level=error&range=30d", { scroll: false });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("takes the range away with Any time", async () => {
    const user = userEvent.setup();
    render(<LogFilterBar page={PAGE} filters={filters({ range: "7d" })} />);

    await user.click(screen.getByRole("button", { name: "Time range, Last 7 days" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Any time" }));

    expect(push).toHaveBeenCalledWith("/logs", { scroll: false });
  });
});
