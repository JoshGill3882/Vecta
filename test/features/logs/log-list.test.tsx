import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";
import { LogList } from "@/src/features/logs/components/log-list";

/** A task entry written at a local time.
 *
 * @param id The entry's id, which is also its task's title.
 * @param at When it was written, in local time.
 * @returns The entry.
 */
function entryAt(id: string, at: Date): LogEntryDTO {
  return {
    id,
    createdAt: at.toISOString(),
    kind: "activity",
    level: "info",
    event: "task.created",
    source: "tasks",
    message: "Created a task",
    detail: { taskId: id, title: id },
  };
}

const NOW = new Date(2026, 10, 14, 15, 0);
const ENTRIES = [
  entryAt("a", new Date(2026, 10, 14, 14, 0)),
  entryAt("b", new Date(2026, 10, 14, 9, 0)),
  entryAt("c", new Date(2026, 10, 13, 18, 0)),
  entryAt("d", new Date(2026, 10, 10, 8, 0)),
];

describe("LogList", () => {
  it("heads each day, newest first", () => {
    render(<LogList entries={ENTRIES} now={NOW} needle="" />);

    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Today",
      "Yesterday",
      "Tue 10 Nov",
    ]);
  });

  it("puts each entry under its own day, as a region named by the heading", () => {
    render(<LogList entries={ENTRIES} now={NOW} needle="" />);

    const today = screen.getByRole("region", { name: "Today" });
    expect(within(today).getByText("Created “a”")).toBeDefined();
    expect(within(today).getByText("Created “b”")).toBeDefined();
    expect(within(today).queryByText("Created “c”")).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Yesterday" })).getByText("Created “c”")
    ).toBeDefined();
  });

  it("keeps the entries in the order given", () => {
    const { container } = render(<LogList entries={ENTRIES} now={NOW} needle="" />);

    const messages = Array.from(container.querySelectorAll("summary")).map(
      (summary) => summary.querySelector("span[title]")?.textContent
    );
    expect(messages).toEqual(["Created “a”", "Created “b”", "Created “c”", "Created “d”"]);
  });

  it("marks the search in every row's message", () => {
    const { container } = render(<LogList entries={ENTRIES} now={NOW} needle="created" />);

    expect(Array.from(container.querySelectorAll("mark"), (mark) => mark.textContent)).toEqual([
      "Created",
      "Created",
      "Created",
      "Created",
    ]);
  });

  it("hides the column header from screen readers, whose rows say what each cell is", () => {
    render(<LogList entries={ENTRIES} now={NOW} needle="" />);

    expect(screen.getByText("Message").parentElement?.getAttribute("aria-hidden")).toBe("true");
  });
});
