import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { LevelBadge } from "@/src/features/logs/components/level-badge";
import { LogRow } from "@/src/features/logs/components/log-row";

/** An entry written at 09:30:05 local time, for a test to change what it needs.
 *
 * @param change The fields that differ from a task being created.
 * @returns The entry.
 */
function entry(change: Partial<LogEntryDTO> = {}): LogEntryDTO {
  return {
    id: "log_1",
    createdAt: new Date(2026, 10, 14, 9, 30, 5).toISOString(),
    kind: "activity",
    level: "info",
    event: "task.created",
    source: "tasks",
    message: "Created a task",
    detail: { taskId: "t1", title: "Buy milk" },
    ...change,
  };
}

/** The row's summary line, which is what a reader clicks.
 *
 * @param container The rendered row.
 * @returns The summary element.
 */
function summaryOf(container: HTMLElement): HTMLElement {
  const summary = container.querySelector("summary");
  if (!summary) throw new Error("the row has no summary");
  return summary;
}

describe("LevelBadge", () => {
  it.each([
    ["debug", "Debug"],
    ["info", "Info"],
    ["warn", "Warning"],
    ["error", "Error"],
  ] as const)("names %s as %s", (level, label) => {
    render(<LevelBadge level={level} />);

    expect(screen.getByText(label)).toBeDefined();
  });

  it("styles Debug as Info, under its own name", () => {
    const { container } = render(
      <>
        <LevelBadge level="debug" />
        <LevelBadge level="info" />
      </>
    );

    const [debug, info] = Array.from(container.children);
    expect(debug.className).toBe(info.className);
    expect(debug.textContent).not.toBe(info.textContent);
  });
});

describe("LogRow", () => {
  it("sums the entry up in one line: time, level, source and message", () => {
    const { container } = render(<LogRow entry={entry()} />);

    const summary = summaryOf(container);
    expect(summary.textContent).toBe("09:30:05InfoTasksCreated “Buy milk”");
    expect(within(summary).getByText("09:30:05").getAttribute("dateTime")).toBe(entry().createdAt);
  });

  it("words the message from the event and its detail", () => {
    const { container } = render(
      <LogRow
        entry={entry({
          event: "category.deleted",
          source: "categories",
          detail: { categoryId: "c1", name: "Work" },
        })}
      />
    );

    expect(within(summaryOf(container)).getByText("Deleted category “Work”")).toBeDefined();
    expect(within(summaryOf(container)).getByText("Categories")).toBeDefined();
  });

  it("offers the whole message on hover, for a line cut short", () => {
    const { container } = render(<LogRow entry={entry()} />);

    expect(within(summaryOf(container)).getByTitle("Created “Buy milk”")).toBeDefined();
  });

  it("starts closed and opens when its line is clicked", async () => {
    const { container } = render(<LogRow entry={entry()} />);
    const details = container.querySelector("details");

    expect(details?.open).toBe(false);
    await userEvent.click(summaryOf(container));
    expect(details?.open).toBe(true);
  });

  it("lists the entry's own fields, then every detail field", () => {
    const { container } = render(<LogRow entry={entry()} />);

    const names = Array.from(container.querySelectorAll("dt")).map((dt) => dt.textContent);
    const values = Array.from(container.querySelectorAll("dd")).map((dd) => dd.textContent);
    expect(names).toEqual(["Timestamp", "Entry ID", "Kind", "Event", "taskId", "title"]);
    expect(values).toEqual([
      entry().createdAt,
      "log_1",
      "activity",
      "task.created",
      "t1",
      "Buy milk",
    ]);
  });

  it("shows a list such as changed as its items", () => {
    const { container } = render(
      <LogRow
        entry={entry({
          event: "task.updated",
          detail: { taskId: "t1", title: "Buy milk", changed: ["title", "status"] },
        })}
      />
    );

    expect(within(container).getByText("title, status").tagName).toBe("DD");
  });

  it("shows an error's stack in a block of its own, apart from its fields", () => {
    const stack = "TypeError: boom\n    at handler (src/x.ts:1:1)";
    const { container } = render(
      <LogRow
        entry={entry({
          kind: "operational",
          level: "error",
          event: "action.unexpected_error",
          source: "system",
          message: "A server action failed unexpectedly",
          detail: { error: { name: "TypeError", message: "boom", stack } },
        })}
      />
    );

    const block = container.querySelector("pre");
    expect(block?.textContent).toBe(stack);
    expect(block?.getAttribute("aria-label")).toBe("error.stack");
    // Focusable, so a keyboard can scroll it.
    expect(block?.tabIndex).toBe(0);
    const names = Array.from(container.querySelectorAll("dt")).map((dt) => dt.textContent);
    expect(names).toContain("error.message");
    expect(names).not.toContain("error.stack");
  });

  it("shows no stack block when there is no stack", () => {
    const { container } = render(<LogRow entry={entry()} />);

    expect(container.querySelector("pre")).toBeNull();
  });

  it("lists only the entry's own fields when it has no detail", () => {
    const { container } = render(
      <LogRow entry={entry({ event: "auth.signed_in", source: "auth", detail: null })} />
    );

    expect(container.querySelectorAll("dt")).toHaveLength(4);
  });

  it("renders a title holding markup as the text it is", () => {
    const title = "<b>bold</b> <img src=x onerror=alert(1)>";
    const { container } = render(<LogRow entry={entry({ detail: { taskId: "t1", title } })} />);

    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(within(summaryOf(container)).getByText(`Created “${title}”`)).toBeDefined();
  });
});
