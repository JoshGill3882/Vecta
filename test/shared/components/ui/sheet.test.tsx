import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Sheet, SheetContent, SheetTitle } from "@/src/shared/components/ui/sheet";

/*
 * The generated sheet has no focus restore of its own: Radix restores to a
 * `SheetTrigger`, and every sheet here is controlled with no trigger. This pins
 * the `useRestoreFocus` wiring added on top, which is what returns a keyboard or
 * screen-reader user to the control they opened the sheet from.
 */

/** A button that opens a controlled sheet, the shape every caller uses. */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetTitle>Filter and Sort</SheetTitle>
        </SheetContent>
      </Sheet>
    </>
  );
}

describe("SheetContent", () => {
  it("returns focus to the control that opened it when closed", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const opener = screen.getByRole("button", { name: "Open sheet" });
    await user.click(opener);
    await screen.findByRole("dialog", { name: "Filter and Sort" });

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("returns focus the same way when dismissed with Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const opener = screen.getByRole("button", { name: "Open sheet" });
    await user.click(opener);
    await screen.findByRole("dialog", { name: "Filter and Sort" });

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });
});
