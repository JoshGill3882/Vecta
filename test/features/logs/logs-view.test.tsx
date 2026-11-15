import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { LogPage } from "@/src/server/services/logs";
import type { LogFilters } from "@/src/shared/lib/schemas/logs";
import { LogsView } from "@/src/features/logs/components/logs-view";

// The filter bar navigates with the router, and there is no Next router in a
// test. The bar's own behaviour is covered in log-filter-bar.test.tsx.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/** No filters, on the first page. */
const NO_FILTERS: LogFilters = { level: [], source: [], page: 1 };

/** An empty page of the log, for a test to fill in what it needs.
 *
 * @param change The fields that differ from an empty log.
 * @returns The page.
 */
function logPage(change: Partial<LogPage> = {}): LogPage {
  return {
    entries: [],
    page: 1,
    pageCount: 1,
    matching: 0,
    total: 0,
    oldest: null,
    levelCounts: { debug: 0, info: 0, warn: 0, error: 0 },
    sourceCounts: { auth: 0, tasks: 0, categories: 0, system: 0 },
    ...change,
  };
}

describe("LogsView", () => {
  it("is headed Logs", () => {
    render(<LogsView filters={NO_FILTERS} page={logPage()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Logs" })).toBeDefined();
  });

  it("counts every entry and dates the oldest", () => {
    render(
      <LogsView
        filters={NO_FILTERS}
        page={logPage({ total: 1204, oldest: "2026-08-17T12:00:00.000Z" })}
      />
    );

    const summary = screen.getByText(/entries since/);
    expect(summary.textContent).toBe("1,204 entries since 17 Aug 2026");
    // The date is a <time>, so the exact moment stays machine-readable.
    expect(summary.querySelector("time")?.getAttribute("dateTime")).toBe(
      "2026-08-17T12:00:00.000Z"
    );
  });

  it("counts the whole log, not what the filters match", () => {
    render(
      <LogsView
        filters={NO_FILTERS}
        page={logPage({ total: 40, matching: 3, oldest: "2026-11-01T12:00:00.000Z" })}
      />
    );

    expect(screen.getByText(/since/).textContent).toBe("40 entries since 1 Nov 2026");
  });

  it("names no date when the log is empty", () => {
    render(<LogsView filters={NO_FILTERS} page={logPage()} />);

    expect(screen.getByText("0 entries")).toBeDefined();
    expect(screen.queryByText(/since/)).toBeNull();
  });

  it("lists the page's entries under their days", () => {
    const createdAt = new Date().toISOString();
    const entry = {
      id: "log_1",
      createdAt,
      kind: "activity" as const,
      level: "info" as const,
      event: "task.created",
      source: "tasks" as const,
      message: "Created a task",
      detail: { taskId: "t1", title: "Buy milk" },
    };
    render(
      <LogsView
        filters={NO_FILTERS}
        page={logPage({ entries: [entry], total: 1, matching: 1, oldest: createdAt })}
      />
    );

    expect(screen.getByRole("heading", { level: 2, name: "Today" })).toBeDefined();
    expect(screen.getByText("Created “Buy milk”")).toBeDefined();
  });

  it("offers the pager once the matching entries fill more than one page", () => {
    render(<LogsView filters={NO_FILTERS} page={logPage({ pageCount: 3, matching: 120 })} />);

    expect(screen.getByRole("navigation", { name: "Log pages" })).toBeDefined();
  });

  it("offers no pager while everything fits on one page", () => {
    render(<LogsView filters={NO_FILTERS} page={logPage({ matching: 50 })} />);

    expect(screen.queryByRole("navigation", { name: "Log pages" })).toBeNull();
  });

  it("says new entries will appear while the log is empty, offering nothing to clear", () => {
    const { container } = render(<LogsView filters={NO_FILTERS} page={logPage()} />);

    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "No log entries" })).toBeDefined();
    expect(screen.getByText("New activity will appear here as it happens.")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();
  });

  it("says nothing matches when the filters match no entries, with a link that clears them", () => {
    const { container } = render(
      <LogsView
        filters={{ level: ["error"], source: ["auth"], page: 1 }}
        page={logPage({ total: 40, matching: 0, oldest: "2026-11-01T12:00:00.000Z" })}
      />
    );

    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "No matching entries" })).toBeDefined();
    expect(screen.getByText("Nothing matches the filters you have on.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Clear filters" }).getAttribute("href")).toBe("/logs");
  });

  it("shows no empty state while there are entries to list", () => {
    const createdAt = new Date().toISOString();
    render(
      <LogsView
        filters={NO_FILTERS}
        page={logPage({
          entries: [
            {
              id: "log_1",
              createdAt,
              kind: "operational",
              level: "info",
              event: "app.started",
              source: "system",
              message: "Started",
              detail: null,
            },
          ],
          total: 1,
          matching: 1,
          oldest: createdAt,
        })}
      />
    );

    expect(screen.queryByRole("heading", { name: "No log entries" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "No matching entries" })).toBeNull();
  });
});
