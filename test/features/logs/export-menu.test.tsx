import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { LogPage } from "@/src/server/services/logs";
import type { LogFilters } from "@/src/shared/lib/schemas/logs";
import { ExportMenu } from "@/src/features/logs/components/export-menu";

/** A page of the log with entries to export, for a test to change what it needs.
 *
 * @param change The fields that differ.
 * @returns The page.
 */
function logPage(change: Partial<LogPage> = {}): LogPage {
  return {
    entries: [],
    page: 1,
    pageCount: 25,
    matching: 1204,
    total: 1204,
    oldest: null,
    levelCounts: { debug: 3, info: 1180, warn: 12, error: 9 },
    sourceCounts: { auth: 40, tasks: 1100, categories: 50, system: 14 },
    readAt: "2026-11-17T19:30:00.000Z",
    ...change,
  };
}

/** Filters for a test, with nothing picked unless it says.
 *
 * @param change The choices that differ from no filters.
 * @returns The filters.
 */
function filters(change: Partial<LogFilters> = {}): LogFilters {
  return { level: [], source: [], page: 1, ...change };
}

/** Opens the menu as a reader would.
 *
 * @returns The menu.
 */
async function openMenu(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole("button", { name: "Export" }));
  return screen.findByRole("menu");
}

describe("ExportMenu", () => {
  it("says it will export every entry when no filter is on", async () => {
    render(<ExportMenu page={logPage()} filters={filters()} />);

    const menu = await openMenu();
    expect(menu.textContent).toContain("All 1,204 entries");
  });

  it("says it will export the entries matching the filters, with their count", async () => {
    render(
      <ExportMenu
        page={logPage({ matching: 12 })}
        filters={filters({ level: ["warn"], page: 3 })}
      />
    );

    const menu = await openMenu();
    expect(menu.textContent).toContain("The 12 entries matching your filters");
  });

  it("counts a single entry as one", async () => {
    render(<ExportMenu page={logPage({ matching: 1 })} filters={filters({ source: ["auth"] })} />);

    expect((await openMenu()).textContent).toContain("The 1 entry matching your filters");
  });

  it("offers CSV for spreadsheets and JSON for full detail", async () => {
    render(<ExportMenu page={logPage()} filters={filters()} />);
    await openMenu();

    expect(screen.getByRole("menuitem", { name: /CSV/ }).textContent).toBe("CSVSpreadsheets");
    expect(screen.getByRole("menuitem", { name: /JSON/ }).textContent).toBe("JSONFull detail");
  });

  it("links each choice to a download of what the filters match, leaving out the page", async () => {
    render(
      <ExportMenu
        page={logPage({ matching: 12 })}
        filters={filters({ level: ["error", "warn"], source: ["auth"], page: 3 })}
      />
    );
    await openMenu();

    const csv = screen.getByRole("menuitem", { name: /CSV/ });
    const json = screen.getByRole("menuitem", { name: /JSON/ });
    expect(csv.tagName).toBe("A");
    expect(csv.getAttribute("href")).toBe(
      "/api/logs/export?format=csv&level=warn&level=error&source=auth"
    );
    expect(json.getAttribute("href")).toBe(
      "/api/logs/export?format=json&level=warn&level=error&source=auth"
    );
    // Marked for download, so the browser saves the file and the page stays put.
    expect(csv.hasAttribute("download")).toBe(true);
    expect(json.hasAttribute("download")).toBe(true);
  });

  it("is disabled, and does not open, when nothing matches", async () => {
    render(<ExportMenu page={logPage({ matching: 0 })} filters={filters({ level: ["debug"] })} />);

    const button = screen.getByRole("button", { name: "Export" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await userEvent.click(button);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("is disabled on an empty log", () => {
    render(<ExportMenu page={logPage({ matching: 0, total: 0 })} filters={filters()} />);

    expect(screen.getByRole("button", { name: "Export" }).hasAttribute("disabled")).toBe(true);
  });

  it("keeps its name on a narrow screen, where only its icon shows", () => {
    render(<ExportMenu page={logPage()} filters={filters()} />);

    // jsdom applies no media queries, so this checks what the narrow layout
    // keeps: a name for a screen reader and a tooltip for a pointer, with the
    // label hidden visually rather than removed.
    const button = screen.getByRole("button", { name: "Export" });
    expect(button.getAttribute("title")).toBe("Export");
    const label = Array.from(button.querySelectorAll("span")).find(
      (s) => s.textContent === "Export"
    );
    expect(label?.className).toContain("max-[520px]:sr-only");
    expect(label?.className).not.toContain("hidden");
    // The chevron goes, so the icon has the square to itself.
    const chevron = button.querySelector("svg.lucide-chevron-down");
    expect(chevron?.getAttribute("class")).toContain("max-[520px]:hidden");
  });

  it("opens from the keyboard", async () => {
    render(<ExportMenu page={logPage()} filters={filters()} />);

    await userEvent.tab();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("menu")).toBeDefined();
  });
});
