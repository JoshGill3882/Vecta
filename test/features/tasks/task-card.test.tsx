import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TaskCard } from "@/src/features/tasks/components/list/task-card";
import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";

const NOW = new Date("2026-11-13T12:00:00");

/** The classes on an element, as a list to assert against.
 *
 * @param element The element to read.
 * @returns Its class names.
 */
function classes(element: Element | null): string[] {
  return element?.className.split(/\s+/) ?? [];
}

/** Renders one card for a task with the given status and a past due date.
 *
 * @param status The task's status.
 * @returns The card's article element.
 */
function renderCard(status: TaskDTO["status"]): HTMLElement {
  const task: TaskDTO = {
    id: "t1",
    title: "Renew the certificate",
    description: "",
    status,
    categoryId: null,
    createdAt: "2026-11-01T09:00:00.000Z",
    updatedAt: "2026-11-01T09:00:00.000Z",
    dueAt: "2026-11-10",
  };
  render(
    <TaskCard task={task} onEdit={() => {}} onDelete={async () => true} needle="" now={NOW} />
  );
  return screen.getByRole("article");
}

/* How a closed card recedes. Its text is measured against the card surface in
   closed-card-contrast.test.ts; this pins that the card actually sits on it. */
describe("TaskCard's closed state", () => {
  it.each(["open", "closed"] as const)("keeps a %s card on the card surface", (status) => {
    expect(classes(renderCard(status))).toContain("bg-card");
  });

  it("never fades a closed card", () => {
    const card = renderCard("closed");
    expect(classes(card).filter((name) => name.startsWith("opacity-"))).toEqual([]);
  });

  it('draws a closed task\'s "Was due" pill in text-3', () => {
    renderCard("closed");
    expect(classes(screen.getByText(/^Was due/).parentElement)).toContain("text-text-3");
  });
});
