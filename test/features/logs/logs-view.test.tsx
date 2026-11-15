import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import type { LogPage } from "@/src/server/services/logs";
import { LogsView } from "@/src/features/logs/components/logs-view";

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
    render(<LogsView page={logPage()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Logs" })).toBeDefined();
  });

  it("counts every entry and dates the oldest", () => {
    render(<LogsView page={logPage({ total: 1204, oldest: "2026-08-17T12:00:00.000Z" })} />);

    const summary = screen.getByText(/entries since/);
    expect(summary.textContent).toBe("1,204 entries since 17 Aug 2026");
    // The date is a <time>, so the exact moment stays machine-readable.
    expect(summary.querySelector("time")?.getAttribute("dateTime")).toBe(
      "2026-08-17T12:00:00.000Z"
    );
  });

  it("counts the whole log, not what the filters match", () => {
    render(
      <LogsView page={logPage({ total: 40, matching: 3, oldest: "2026-11-01T12:00:00.000Z" })} />
    );

    expect(screen.getByText(/since/).textContent).toBe("40 entries since 1 Nov 2026");
  });

  it("names no date when the log is empty", () => {
    render(<LogsView page={logPage()} />);

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
      <LogsView page={logPage({ entries: [entry], total: 1, matching: 1, oldest: createdAt })} />
    );

    expect(screen.getByRole("heading", { level: 2, name: "Today" })).toBeDefined();
    expect(screen.getByText("Created “Buy milk”")).toBeDefined();
  });

  it("draws no list when the page has no entries", () => {
    const { container } = render(<LogsView page={logPage()} />);

    expect(container.querySelector("details")).toBeNull();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });
});
