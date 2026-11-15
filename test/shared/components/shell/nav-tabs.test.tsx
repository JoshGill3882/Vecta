import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { AppNav, AppNavMobile, LogsLink } from "@/src/shared/components/shell/nav-tabs";

// There is no Next router in a test, so the current path is whatever each test
// sets here.
let pathname = "/tasks";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

beforeEach(() => {
  pathname = "/tasks";
});

describe("LogsLink", () => {
  it("links to the Logs page, named for screen readers and on hover", () => {
    render(<LogsLink />);

    const link = screen.getByRole("link", { name: "Logs" });
    expect(link.getAttribute("href")).toBe("/logs");
    expect(link.getAttribute("title")).toBe("Logs");
  });

  it.each(["/logs", "/logs/anything"])("is marked as the current page on %s", (path) => {
    pathname = path;
    render(<LogsLink />);

    expect(screen.getByRole("link", { name: "Logs" }).getAttribute("aria-current")).toBe("page");
  });

  it.each(["/tasks", "/categories", "/logsheet"])("is not the current page on %s", (path) => {
    // `/logsheet` only shares the prefix, so it must not light the button.
    pathname = path;
    render(<LogsLink />);

    expect(screen.getByRole("link", { name: "Logs" }).hasAttribute("aria-current")).toBe(false);
  });
});

describe("the tabs", () => {
  // The Logs page is reached by its button, so neither row of tabs grows a
  // third entry, and neither marks a tab as current while it is open.
  it.each([
    ["desktop", AppNav],
    ["mobile", AppNavMobile],
  ])("keep to Tasks and Categories in the %s row", (_, Nav) => {
    pathname = "/logs";
    render(<Nav />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Tasks", "Categories"]);
    for (const link of links) expect(link.hasAttribute("aria-current")).toBe(false);
  });
});
