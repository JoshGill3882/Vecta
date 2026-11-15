import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";

import { EmptyState } from "@/src/shared/components/empty-state";

describe("EmptyState", () => {
  it("shows its heading and text", () => {
    render(
      <EmptyState icon={Inbox} heading="Nothing here">
        Things will appear as they arrive.
      </EmptyState>
    );

    expect(screen.getByRole("heading", { level: 2, name: "Nothing here" })).toBeDefined();
    expect(screen.getByText("Things will appear as they arrive.")).toBeDefined();
  });

  it("lets the heading take focus only when it has an id to be found by", () => {
    const { rerender } = render(
      <EmptyState icon={Inbox} heading="Nothing here">
        Text.
      </EmptyState>
    );
    expect(screen.getByRole("heading").hasAttribute("tabindex")).toBe(false);

    rerender(
      <EmptyState icon={Inbox} heading="Nothing here" headingId="empty-heading">
        Text.
      </EmptyState>
    );
    const heading = screen.getByRole("heading");
    expect(heading.id).toBe("empty-heading");
    expect(heading.getAttribute("tabindex")).toBe("-1");
  });

  it("shows the action it is given, and none otherwise", () => {
    const { rerender } = render(
      <EmptyState icon={Inbox} heading="Nothing here">
        Text.
      </EmptyState>
    );
    expect(screen.queryByRole("button")).toBeNull();

    rerender(
      <EmptyState icon={Inbox} heading="Nothing here" action={<button>Undo</button>}>
        Text.
      </EmptyState>
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeDefined();
  });
});
