import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";

// The editor and the row's delete both ask the router for a fresh read, and
// there is no Next router in a test.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// Toasts render into a portal this view does not mount.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// The actions reach Prisma through the service layer, which cannot load in
// jsdom, so each is stubbed at the boundary.
const createCategoryAction = vi.fn(async (_state: unknown, formData: FormData) => ({
  ok: true as const,
  data: {
    id: "c9",
    name: String(formData.get("name")),
    color: String(formData.get("color")),
    createdAt: "2026-11-26T00:00:00.000Z",
  },
}));
const updateCategoryAction = vi.fn();
const deleteCategoryAction = vi.fn();
vi.mock("@/src/features/categories/actions", () => ({
  createCategoryAction: (...args: [unknown, FormData]) => createCategoryAction(...args),
  updateCategoryAction: (...args: unknown[]) => updateCategoryAction(...args),
  deleteCategoryAction: (...args: unknown[]) => deleteCategoryAction(...args),
}));

// Imported after the mocks so the view picks them up.
const { CategoriesView } = await import("@/src/features/categories/components/categories-view");

beforeEach(() => {
  refresh.mockReset();
  createCategoryAction.mockClear();
  updateCategoryAction.mockReset();
  deleteCategoryAction.mockReset();
});

/** Builds a category fixture.
 *
 * @param id Tells two fixtures apart.
 * @param name The name the search is matched against.
 * @returns A complete category.
 */
function category(id: string, name: string): CategoryDTO {
  return { id, name, color: "#3b9eff", createdAt: "2026-09-01T00:00:00.000Z" };
}

const categories = [
  category("c1", "Frontend"),
  category("c2", "Backend"),
  category("c3", "Personal"),
  category("c4", "Infrastructure"),
];

/** Renders the view with the props the route supplies.
 *
 * @param list The categories to show.
 * @returns Testing Library's render result, for rerendering with a new list.
 */
function renderView(list: CategoryDTO[] = categories) {
  return render(<CategoriesView categories={list} taskCounts={{}} />);
}

/** The search box. */
function searchBox() {
  return screen.getByRole("searchbox", { name: "Search categories" });
}

/** The names the list shows, in its order, read from each row's Edit button. */
function shownNames() {
  return screen
    .queryAllByRole("button", { name: /^Edit / })
    .map((button) => button.getAttribute("aria-label")?.replace(/^Edit /, ""));
}

describe("CategoriesView search", () => {
  it("has no search box until there is a category to search", () => {
    renderView([]);

    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("narrows the list as each key is pressed, keeping its order", async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(searchBox(), "n");
    expect(shownNames()).toEqual(["Frontend", "Backend", "Personal", "Infrastructure"]);

    await user.type(searchBox(), "d");
    expect(shownNames()).toEqual(["Frontend", "Backend"]);
  });

  it("ignores case and the spaces at either end", async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(searchBox(), "  INFRA ");

    expect(shownNames()).toEqual(["Infrastructure"]);
  });

  it("marks the matched text in each name", async () => {
    const user = userEvent.setup();
    const { container } = renderView();

    await user.type(searchBox(), "end");

    const marks = [...container.querySelectorAll("mark")].map((mark) => mark.textContent);
    expect(marks).toEqual(["end", "end"]);
  });

  it("says how many categories match out of how many, in a live region", async () => {
    const user = userEvent.setup();
    renderView();
    expect(screen.getByRole("status").textContent).toBe(
      "Flat labels to group your tasks. 4 total."
    );

    await user.type(searchBox(), "end");

    expect(screen.getByRole("status").textContent).toBe("2 of 4 categories");
  });

  it("counts a single category in the singular", async () => {
    const user = userEvent.setup();
    renderView([category("c1", "Frontend")]);

    await user.type(searchBox(), "front");

    expect(screen.getByRole("status").textContent).toBe("1 of 1 category");
  });

  it("names the search when nothing matches, and its Clear search empties the box and focuses it", async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(searchBox(), " invoices ");
    expect(shownNames()).toEqual([]);
    const message = screen.getByText("No categories match “invoices”.");

    await user.click(within(message.parentElement!).getByRole("button", { name: "Clear search" }));

    expect(searchBox()).toHaveProperty("value", "");
    expect(document.activeElement).toBe(searchBox());
    expect(shownNames()).toHaveLength(4);
  });

  it("is focused by a slash typed elsewhere on the page", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("heading", { name: "Categories" }));
    await user.keyboard("/");

    expect(document.activeElement).toBe(searchBox());
  });

  it("empties the search once a category is created, so the new one is in view", async () => {
    const user = userEvent.setup();
    renderView();
    await user.type(searchBox(), "end");

    await user.click(screen.getByRole("button", { name: "New category" }));
    await user.type(screen.getByLabelText("Name"), "Ideas");
    await user.click(screen.getByRole("button", { name: "Create category" }));

    await waitFor(() => expect(searchBox()).toHaveProperty("value", ""));
    expect(createCategoryAction).toHaveBeenCalledOnce();
  });

  it("keeps the category being edited in the list until its editor closes, whatever its name", async () => {
    const user = userEvent.setup();
    const { rerender } = renderView();
    await user.type(searchBox(), "end");
    await user.click(screen.getByRole("button", { name: "Edit Frontend" }));

    // A refresh lands while the editor is open, with the category renamed
    // away from the search.
    const renamed = categories.map((item) => (item.id === "c1" ? category("c1", "Website") : item));
    rerender(<CategoriesView categories={renamed} taskCounts={{}} />);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("2 of 4 categories");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(shownNames()).toEqual(["Backend"]);
  });

  it("sends nothing to the server as the search is typed", async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(searchBox(), "end");
    await user.clear(searchBox());

    expect(refresh).not.toHaveBeenCalled();
    expect(createCategoryAction).not.toHaveBeenCalled();
    expect(updateCategoryAction).not.toHaveBeenCalled();
    expect(deleteCategoryAction).not.toHaveBeenCalled();
  });
});
