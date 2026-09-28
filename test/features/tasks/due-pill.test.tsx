import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { DuePill } from "@/src/features/tasks/components/due-pill";

// Sunday 27 September 2026, 10:00 local.
const NOW = new Date(2026, 8, 27, 10, 0);

describe("DuePill", () => {
  // No "No due date" placeholder: a task without one shows nothing at all.
  it("renders nothing when the task has no due date", () => {
    const { container } = render(<DuePill task={{ dueAt: null, status: "open" }} now={NOW} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the short label", () => {
    render(<DuePill task={{ dueAt: "2026-09-28T17:30", status: "open" }} now={NOW} />);
    expect(screen.getByText("Due tomorrow · 17:30")).toBeDefined();
  });

  it("offers the full date on hover", () => {
    render(<DuePill task={{ dueAt: "2026-10-09", status: "open" }} now={NOW} />);
    expect(screen.getByTitle("Friday, 9 October 2026")).toBeDefined();
  });

  // aria-label is ignored on a plain span, so the full date is in the text itself,
  // visually hidden - which is what a screen reader reads.
  it("gives screen readers the full date as well as the label", () => {
    const { container } = render(
      <DuePill task={{ dueAt: "2026-10-09T17:30", status: "open" }} now={NOW} />
    );
    expect(container.textContent).toBe("Due 9 Oct · 17:30, Friday, 9 October 2026 at 17:30");
    expect(screen.getByText(", Friday, 9 October 2026 at 17:30").className).toContain("sr-only");
  });

  // Colour is never the only signal: the overdue state says so in words too.
  it("says in words that a task is overdue, not only in colour", () => {
    render(<DuePill task={{ dueAt: "2026-09-25", status: "open" }} now={NOW} />);
    expect(screen.getByText("2 days overdue")).toBeDefined();
  });

  it("words a closed task's date in the past", () => {
    render(<DuePill task={{ dueAt: "2026-09-25", status: "closed" }} now={NOW} />);
    expect(screen.getByText("Was due 25 Sept")).toBeDefined();
  });
});
