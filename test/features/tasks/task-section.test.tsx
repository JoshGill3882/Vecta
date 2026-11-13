import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskSection } from "@/src/features/tasks/components/list/task-section";
import type { TaskDTO, TaskStatus } from "@/src/shared/lib/dtos/tasks";
import { TASK_STATUSES } from "@/src/shared/lib/task-status";

/** The classes on an element, as a list to assert against.
 *
 * @param element The element to read.
 * @returns Its class names.
 */
function classes(element: Element | null): string[] {
  return element?.className.split(/\s+/) ?? [];
}

/** Renders one section and returns the status dot beside its label.
 *
 * @param status The section's status.
 * @param tasks The tasks it holds; an empty section renders a plain heading.
 * @returns The dot element.
 */
function renderDot(status: TaskStatus, tasks: TaskDTO[]): Element | null {
  const label = TASK_STATUSES.find((s) => s.id === status)!.label;
  render(
    <TaskSection
      status={status}
      label={label}
      tasks={tasks}
      categoriesById={new Map()}
      collapsed={false}
      onCollapsedChange={() => {}}
      onEdit={() => {}}
      onDelete={async () => true}
      needle=""
      now={new Date("2026-11-13T12:00:00")}
    />
  );
  return within(screen.getByRole("heading", { level: 2 })).getByText(label).previousElementSibling;
}

const TASK: TaskDTO = {
  id: "t1",
  title: "Renew the certificate",
  description: "",
  status: "open",
  categoryId: null,
  createdAt: "2026-11-01T09:00:00.000Z",
  updatedAt: "2026-11-01T09:00:00.000Z",
  dueAt: null,
};

/* The section header's dot is flat, like the dots on status badges and in the
   status picker: one solid colour, with no translucent ring around it. */
describe("TaskSection's status dot", () => {
  it.each(TASK_STATUSES.map((s) => s.id))("is a plain dot for %s", (status) => {
    const dot = classes(renderDot(status, [{ ...TASK, status }]));
    expect(dot).toContain("size-2");
    expect(dot.filter((name) => name.startsWith("ring"))).toEqual([]);
  });

  it("is a plain dot on an empty section's heading too", () => {
    const dot = classes(renderDot("closed", []));
    expect(dot).toContain("bg-status-closed");
    expect(dot.filter((name) => name.startsWith("ring"))).toEqual([]);
  });
});
