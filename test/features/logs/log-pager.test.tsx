import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import type { LogPage } from "@/src/server/services/logs";
import type { LogFilters } from "@/src/shared/lib/schemas/logs";
import { LogPager } from "@/src/features/logs/components/log-pager";

/** No filters, on the first page. */
const NO_FILTERS: LogFilters = { level: [], source: [], page: 1 };

/** A page of a log of 1,204 matching entries, which fills 25 pages.
 *
 * @param page Which page it is.
 * @param change Any other fields that differ.
 * @returns The page.
 */
function logPage(page: number, change: Partial<LogPage> = {}): LogPage {
  return {
    entries: [],
    page,
    pageCount: 25,
    matching: 1204,
    total: 1204,
    oldest: null,
    levelCounts: { debug: 0, info: 1204, warn: 0, error: 0 },
    sourceCounts: { auth: 0, tasks: 1204, categories: 0, system: 0 },
    ...change,
  };
}

describe("LogPager", () => {
  it("draws nothing while the matching entries fit on one page", () => {
    const { container } = render(
      <LogPager page={logPage(1, { pageCount: 1, matching: 50 })} filters={NO_FILTERS} />
    );

    expect(container.innerHTML).toBe("");
  });

  it("is a navigation landmark named for the log's pages", () => {
    render(<LogPager page={logPage(2)} filters={NO_FILTERS} />);

    expect(screen.getByRole("navigation", { name: "Log pages" })).toBeDefined();
  });

  it("says which entries the page shows, of how many", () => {
    render(<LogPager page={logPage(2)} filters={NO_FILTERS} />);

    expect(screen.getByText("51-100 of 1,204")).toBeDefined();
  });

  it("links to the pages either side", () => {
    render(<LogPager page={logPage(3)} filters={NO_FILTERS} />);

    expect(screen.getByRole("link", { name: "Newer" }).getAttribute("href")).toBe("/logs?page=2");
    expect(screen.getByRole("link", { name: "Older" }).getAttribute("href")).toBe("/logs?page=4");
  });

  it("links to the plain address for the first page", () => {
    render(<LogPager page={logPage(2)} filters={NO_FILTERS} />);

    expect(screen.getByRole("link", { name: "Newer" }).getAttribute("href")).toBe("/logs");
  });

  it("keeps the filters on both links", () => {
    render(
      <LogPager
        page={logPage(2)}
        filters={{ level: ["warn", "error"], source: ["auth"], page: 2 }}
      />
    );

    expect(screen.getByRole("link", { name: "Newer" }).getAttribute("href")).toBe(
      "/logs?level=warn&level=error&source=auth"
    );
    expect(screen.getByRole("link", { name: "Older" }).getAttribute("href")).toBe(
      "/logs?level=warn&level=error&source=auth&page=3"
    );
  });

  // The server shows the last page for one past it, so the links are counted
  // from the page shown, not the one the URL asked for.
  it("counts from the page shown, not the page asked for", () => {
    render(<LogPager page={logPage(25)} filters={{ ...NO_FILTERS, page: 90 }} />);

    expect(screen.getByRole("link", { name: "Newer" }).getAttribute("href")).toBe("/logs?page=24");
    expect(screen.getByText("1,201-1,204 of 1,204")).toBeDefined();
  });

  it("dims Newer on the first page, still offering Older", () => {
    render(<LogPager page={logPage(1)} filters={NO_FILTERS} />);

    const newer = screen.getByRole("button", { name: "Newer" });
    expect(newer.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("link", { name: "Newer" })).toBeNull();
    expect(screen.getByRole("link", { name: "Older" })).toBeDefined();
  });

  it("dims Older on the last page, still offering Newer", () => {
    render(<LogPager page={logPage(25)} filters={NO_FILTERS} />);

    const older = screen.getByRole("button", { name: "Older" });
    expect(older.hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("link", { name: "Older" })).toBeNull();
    expect(screen.getByRole("link", { name: "Newer" })).toBeDefined();
  });
});
