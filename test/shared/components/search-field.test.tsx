import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SearchField } from "@/src/shared/components/search-field";

/** A box wired to real state, as a page holds it.
 *
 * @param props What the test varies, and spies for what it watches.
 * @returns The box, beside a plain field to type in and a button to focus.
 */
function Harness({
  initial = "",
  onClear,
  maxLength,
  slashShortcut,
  onPageEscape,
}: {
  initial?: string;
  onClear?: () => void;
  maxLength?: number;
  slashShortcut?: boolean;
  onPageEscape?: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape") onPageEscape?.();
      }}
    >
      <SearchField
        id="the-search"
        label="Search things"
        placeholder="Search things..."
        value={value}
        onChange={setValue}
        onClear={
          onClear &&
          (() => {
            onClear();
            setValue("");
          })
        }
        maxLength={maxLength}
        slashShortcut={slashShortcut}
      />
      <input aria-label="Another field" />
      <button>Elsewhere</button>
    </div>
  );
}

/** The search box. */
function box() {
  return screen.getByRole("searchbox", { name: "Search things" });
}

describe("SearchField", () => {
  it("is named and hinted as the page asks, with the id it is given", () => {
    render(<Harness />);

    expect(box().id).toBe("the-search");
    expect(box().getAttribute("placeholder")).toBe("Search things...");
  });

  it("offers a clear button only once something is typed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

    await user.type(box(), "milk");

    expect(screen.getByRole("button", { name: "Clear search" })).toBeDefined();
  });

  it("empties the box with the clear button and leaves focus in it", async () => {
    const user = userEvent.setup();
    render(<Harness initial="milk" />);

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(box()).toHaveProperty("value", "");
    expect(document.activeElement).toBe(box());
  });

  it("calls the page's own clear in place of an empty change, when it has one", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<Harness initial="milk" onClear={onClear} />);

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(onClear).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(box());
  });

  it("empties the box with Escape, leaving focus in it and the page none the wiser", async () => {
    const user = userEvent.setup();
    const onPageEscape = vi.fn();
    render(<Harness onPageEscape={onPageEscape} />);

    await user.type(box(), "milk");
    await user.keyboard("{Escape}");

    expect(box()).toHaveProperty("value", "");
    expect(document.activeElement).toBe(box());
    expect(onPageEscape).not.toHaveBeenCalled();
  });

  it("steps out of an empty box with Escape, and lets the page have the key", async () => {
    const user = userEvent.setup();
    const onPageEscape = vi.fn();
    render(<Harness onPageEscape={onPageEscape} />);

    await user.click(box());
    await user.keyboard("{Escape}");

    expect(document.activeElement).not.toBe(box());
    expect(onPageEscape).toHaveBeenCalledOnce();
  });

  it("takes no more than its limit", async () => {
    const user = userEvent.setup();
    render(<Harness maxLength={4} />);

    await user.type(box(), "milkshake");

    expect(box()).toHaveProperty("value", "milk");
  });

  describe("with the slash shortcut", () => {
    it("is focused by a slash typed anywhere else on the page, without the slash", async () => {
      const user = userEvent.setup();
      render(<Harness slashShortcut />);

      await user.click(screen.getByRole("button", { name: "Elsewhere" }));
      await user.keyboard("/");

      expect(document.activeElement).toBe(box());
      expect(box()).toHaveProperty("value", "");
    });

    it("leaves a slash typed in another field to that field", async () => {
      const user = userEvent.setup();
      render(<Harness slashShortcut />);

      await user.type(screen.getByRole("textbox", { name: "Another field" }), "a/b");

      expect(screen.getByRole("textbox", { name: "Another field" })).toHaveProperty("value", "a/b");
      expect(document.activeElement).not.toBe(box());
    });

    it("leaves a slash held with a modifier alone", async () => {
      const user = userEvent.setup();
      render(<Harness slashShortcut />);

      await user.click(screen.getByRole("button", { name: "Elsewhere" }));
      await user.keyboard("{Control>}/{/Control}");

      expect(document.activeElement).not.toBe(box());
    });
  });

  it("ignores a slash when the page has not asked for the shortcut", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    await user.keyboard("/");

    expect(document.activeElement).not.toBe(box());
  });
});
