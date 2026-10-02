import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { TaskStatus } from "@/src/shared/lib/dtos/tasks";
import { DueDateField } from "@/src/features/tasks/components/dialog/due-date-field";
import { quickDates } from "@/src/features/tasks/lib/date-input";

/** Makes the browser report a mouse or a finger as its primary pointer.
 *
 * jsdom has no `matchMedia`, and the field asks it which version to render.
 *
 * @param coarse True to report a touch screen.
 */
function stubPointer(coarse: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(pointer: coarse)" ? coarse : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** Holds the due date the way the task form does, and shows what it holds.
 *
 * @param props.initial The stored due date on first render.
 * @param props.status The task's status, which the preview pill reads.
 */
function Harness({
  initial = null,
  status = "open",
}: {
  initial?: string | null;
  status?: TaskStatus;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <>
      <label htmlFor="due">Due date</label>
      <DueDateField id="due" value={value} onChange={setValue} status={status} />
      <output data-testid="stored">{value ?? "none"}</output>
    </>
  );
}

/** What the field has stored, as the harness shows it.
 *
 * @returns The stored due date, or "none".
 */
function stored() {
  return screen.getByTestId("stored").textContent;
}

/** The line under the field: the preview, or the hint for a rejected date.
 *
 * Found through what the date input is described by, as a screen reader finds
 * it. The page holds other live regions - React Aria adds one of its own.
 *
 * @returns Its text.
 */
function helperText() {
  const id = screen.getByLabelText("Due date").getAttribute("aria-describedby");
  return id ? document.getElementById(id)?.textContent : undefined;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DueDateField with a mouse and keyboard", () => {
  beforeEach(() => stubPointer(false));

  describe("typing a date", () => {
    it("reads it on Enter and rewrites it in one standard form", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const input = screen.getByLabelText("Due date");
      await user.type(input, "24/9/26{Enter}");

      expect(stored()).toBe("2026-09-24");
      expect((input as HTMLInputElement).value).toBe("24 Sept 2026");
    });

    it("reads it when the field is left", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.type(screen.getByLabelText("Due date"), "2026-10-09");
      await user.tab();

      expect(stored()).toBe("2026-10-09");
    });

    it("does not submit the surrounding form on Enter", async () => {
      const user = userEvent.setup();
      const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={submit}>
          <Harness />
        </form>
      );

      await user.type(screen.getByLabelText("Due date"), "today{Enter}");

      expect(submit).not.toHaveBeenCalled();
    });

    it("rejects text that names no date, announces why, and keeps the date it had", async () => {
      const user = userEvent.setup();
      render(<Harness initial="2026-09-24" />);

      const input = screen.getByLabelText("Due date");
      await user.clear(input);
      await user.type(input, "31/02{Enter}");

      expect(stored()).toBe("2026-09-24");
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(helperText()).toBe("Try 24/09/2026, 24 Sep, today or +3.");
      // The line is a live region, so the rejection is announced as it appears.
      expect(
        document.getElementById(input.getAttribute("aria-describedby")!)?.getAttribute("aria-live")
      ).toBe("polite");
    });

    it("drops the rejection as soon as the text is edited", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const input = screen.getByLabelText("Due date");
      await user.type(input, "soon{Enter}");
      await user.type(input, "x");

      expect(input.getAttribute("aria-invalid")).toBe("false");
      expect(helperText()).toBe("No due date.");
    });

    it("clears the due date, and its time, when the text is emptied", async () => {
      const user = userEvent.setup();
      render(<Harness initial="2026-09-24T17:30" />);

      const input = screen.getByLabelText("Due date");
      await user.clear(input);
      await user.tab();

      expect(stored()).toBe("none");
    });
  });

  describe("the calendar", () => {
    it("sets the picked day and closes", async () => {
      const user = userEvent.setup();
      render(<Harness initial="2026-09-01" />);

      await user.click(screen.getByRole("button", { name: "Open calendar" }));
      const grid = await screen.findByRole("grid");
      await user.click(within(grid).getByRole("button", { name: /24 September 2026/ }));

      expect(stored()).toBe("2026-09-24");
      expect(screen.queryByRole("grid")).toBeNull();
    });

    it("keeps the time when a new day is picked", async () => {
      const user = userEvent.setup();
      render(<Harness initial="2026-09-01T09:15" />);

      await user.click(screen.getByRole("button", { name: "Open calendar" }));
      const grid = await screen.findByRole("grid");
      await user.click(within(grid).getByRole("button", { name: /24 September 2026/ }));

      expect(stored()).toBe("2026-09-24T09:15");
    });

    it("starts the week on Monday", async () => {
      const user = userEvent.setup();
      render(<Harness initial="2026-09-01" />);

      await user.click(screen.getByRole("button", { name: "Open calendar" }));
      const grid = await screen.findByRole("grid");
      // The header row is hidden from screen readers, since every day button
      // already names its full date, so it is read as text.
      const headers = [...grid.querySelectorAll("thead th")].map((th) => th.textContent);

      expect(headers).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    });

    it("offers the quick dates", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(screen.getByRole("button", { name: "Open calendar" }));
      await user.click(await screen.findByRole("button", { name: "Tomorrow" }));

      expect(stored()).toBe(quickDates(new Date())[1].dayKey);
    });
  });

  describe("the time", () => {
    it("cannot be set until there is a date", () => {
      render(<Harness />);

      for (const segment of screen.getAllByRole("spinbutton")) {
        expect(segment.getAttribute("aria-disabled")).toBe("true");
      }
    });

    it("is stored once both segments hold a value", async () => {
      const user = userEvent.setup();
      render(<Harness initial="2026-09-24" />);

      const [hour] = screen.getAllByRole("spinbutton");
      await user.click(hour);
      await user.keyboard("14");
      expect(stored()).toBe("2026-09-24");

      await user.keyboard("30");
      expect(stored()).toBe("2026-09-24T14:30");
    });

    it("steps the hour with the arrow buttons, from midnight when empty", async () => {
      const user = userEvent.setup();
      render(<Harness initial="2026-09-24" />);

      await user.click(screen.getByRole("button", { name: "Increase time" }));

      expect(stored()).toBe("2026-09-24T01:00");
    });

    it("is removed by its own button, leaving the date", async () => {
      const user = userEvent.setup();
      render(<Harness initial="2026-09-24T17:30" />);

      await user.click(screen.getByRole("button", { name: "Remove time" }));

      expect(stored()).toBe("2026-09-24");
    });
  });

  it("clears the date and time together from the clear button", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-09-24T17:30" />);

    await user.click(screen.getByRole("button", { name: "Clear due date" }));

    expect(stored()).toBe("none");
    expect(screen.queryByRole("button", { name: "Clear due date" })).toBeNull();
  });
});

describe("DueDateField on touch", () => {
  beforeEach(() => stubPointer(true));

  it("uses the device's own date and time pickers", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Due date").getAttribute("type")).toBe("date");
    expect(screen.getByLabelText("Due time").getAttribute("type")).toBe("time");
    expect(screen.queryByRole("button", { name: "Open calendar" })).toBeNull();
  });

  it("stores what the date picker reports", () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-24" } });

    expect(stored()).toBe("2026-09-24");
  });

  it("stores the time as hours and minutes, even when seconds are reported", () => {
    render(<Harness initial="2026-09-24" />);

    fireEvent.change(screen.getByLabelText("Due time"), { target: { value: "17:30:00" } });

    expect(stored()).toBe("2026-09-24T17:30");
  });

  it("cannot set a time until there is a date", () => {
    render(<Harness />);

    expect((screen.getByLabelText("Due time") as HTMLInputElement).disabled).toBe(true);
  });

  it("sets a quick date from its chip, and marks the chip that matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const tomorrow = screen.getByRole("button", { name: "Tomorrow" });
    await user.click(tomorrow);

    expect(stored()).toBe(quickDates(new Date())[1].dayKey);
    expect(tomorrow.getAttribute("aria-pressed")).toBe("true");
  });

  it("clears the date and time together from the Clear chip", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-09-24T17:30" />);

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(stored()).toBe("none");
  });

  it("removes only the time from the Remove time chip", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-09-24T17:30" />);

    await user.click(screen.getByRole("button", { name: "Remove time" }));

    expect(stored()).toBe("2026-09-24");
  });
});

describe("DueDateField's preview line", () => {
  beforeEach(() => stubPointer(false));

  it("says there is no due date when there is none", () => {
    render(<Harness />);

    expect(helperText()).toBe("No due date.");
  });

  it("previews the card's pill, due by the end of the day when no time is set", () => {
    render(<Harness initial="2026-10-09" />);

    expect(helperText()).toMatch(/^Shows as .*Due 9 Oct.*· due by end of day$/);
  });

  it("leaves off the end-of-day note once a time is set", () => {
    render(<Harness initial="2026-10-09T17:30" />);

    expect(helperText()).toMatch(/Due 9 Oct · 17:30/);
    expect(helperText()).not.toMatch(/end of day/);
  });

  it("previews a closed task's pill as the card shows it", () => {
    render(<Harness initial="2026-10-09" status="closed" />);

    expect(helperText()).toMatch(/Was due 9 Oct/);
  });
});
