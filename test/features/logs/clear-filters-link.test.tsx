import { describe, it, expect, vi } from "vitest";
import type { MouseEvent, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { LogPage } from "@/src/server/services/logs";
import { ClearFiltersLink } from "@/src/features/logs/components/clear-filters-link";
import { LogFilterBar } from "@/src/features/logs/components/log-filter-bar";

// The filter bar navigates with the router, and there is no Next router in a
// test.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Next's Link needs the app router to navigate. A plain anchor keeps its
// address and its click handler, and stops jsdom trying to follow it.
vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    children,
    ...props
  }: {
    href: string;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    children: ReactNode;
  }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  ),
}));

const PAGE: LogPage = {
  entries: [],
  page: 1,
  pageCount: 1,
  matching: 0,
  total: 40,
  oldest: null,
  levelCounts: { debug: 0, info: 30, warn: 6, error: 4 },
  sourceCounts: { auth: 10, tasks: 20, categories: 0, system: 10 },
  readAt: "2026-11-17T19:30:00.000Z",
};

describe("ClearFiltersLink", () => {
  it("links to the unfiltered log", () => {
    render(<ClearFiltersLink />);

    expect(screen.getByRole("link", { name: "Clear filters" }).getAttribute("href")).toBe("/logs");
  });

  it("sends focus to the Level filter as it clears, as the filter bar's own Clear filters does", async () => {
    const user = userEvent.setup();
    render(
      <>
        <LogFilterBar page={PAGE} filters={{ level: ["error"], source: ["categories"], page: 1 }} />
        <ClearFiltersLink />
      </>
    );

    await user.click(screen.getByRole("link", { name: "Clear filters" }));

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Level, 1 selected" }));
  });

  it("leaves focus alone when there is no filter bar to send it to", async () => {
    const user = userEvent.setup();
    render(<ClearFiltersLink />);

    await user.click(screen.getByRole("link", { name: "Clear filters" }));

    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Clear filters" }));
  });
});
