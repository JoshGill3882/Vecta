import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { CategoryChip } from "@/src/shared/components/category-chip";

/*
 * The chip truncates a long name when its parent lets it shrink. jsdom does no
 * layout, so whether the ellipsis appears cannot be observed here — that is
 * checked in a real browser. What can be pinned is the half that matters for
 * anyone not reading the pixels: truncation is visual only, and the full name
 * stays in the document and on the hover title.
 */
describe("CategoryChip", () => {
  // The longest name the category schema accepts.
  const longName = "Infrastructure, deployment and the release pipeline for v1.x";

  it("keeps the full name in the text, however long", () => {
    render(<CategoryChip name={longName} color="#3b9eff" />);

    expect(screen.getByText(longName)).toBeDefined();
  });

  it("offers the full name as a hover title", () => {
    render(<CategoryChip name={longName} color="#3b9eff" />);

    expect(screen.getByTitle(longName)).toBeDefined();
  });

  it("applies the caller's class, which is how a parent opts in to truncation", () => {
    render(<CategoryChip name="Infrastructure" color="#3b9eff" className="min-w-0" />);

    expect(screen.getByTitle("Infrastructure").className).toContain("min-w-0");
  });
});
