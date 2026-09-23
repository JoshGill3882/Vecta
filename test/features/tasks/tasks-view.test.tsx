import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import { SECTION_COLLAPSE_DEFAULTS } from "@/src/features/tasks/lib/section-collapse";
import { tasksEmptyStateHeadingId } from "@/src/features/tasks/components/tasks-empty-state";

// `useServerAction` calls `useRouter().refresh()` after every action, and there
// is no Next router in a test. Mocking the module is how any component reaching
// `next/navigation` — directly or, as here, through a hook — becomes renderable.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Toasts render into a portal this view does not mount, so assertions would
// have nothing to find. Stubbed to keep the action path quiet and observable.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// The action modules reach Prisma through the service layer, which cannot load
// in jsdom. Every action a rendered view can invoke is stubbed at the boundary.
const deleteTaskAction = vi.fn(async () => ({ ok: true as const, data: undefined }));
vi.mock("@/src/features/tasks/actions", () => ({
  createTaskAction: vi.fn(async () => ({ ok: true, data: null })),
  updateTaskAction: vi.fn(async () => ({ ok: true, data: null })),
  deleteTaskAction: (...args: unknown[]) => deleteTaskAction(...(args as [])),
}));
vi.mock("@/src/features/categories/actions", () => ({
  createCategoryAction: vi.fn(async () => ({ ok: true, data: null })),
}));

// Imported after the mocks so the view picks them up.
const { TasksView } = await import("@/src/features/tasks/components/tasks-view");

const categories: CategoryDTO[] = [
  { id: "c1", name: "Infrastructure", color: "#3b9eff", createdAt: "2026-09-01T00:00:00.000Z" },
];

/** Builds a task fixture.
 *
 * @param over Fields to override on the default open, uncategorised task.
 * @returns One task in the shape the view receives it.
 */
function task(over: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: "t1",
    title: "Rate-limit failed login attempts",
    description: "",
    status: "open",
    categoryId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

/** Renders the view with the props the route supplies.
 *
 * @param tasks The list to show.
 * @returns Testing Library's render result, for rerendering with a new list.
 */
function renderView(tasks: TaskDTO[]) {
  return render(
    <TasksView
      tasks={tasks}
      categories={categories}
      initialSort="updated_desc"
      initialCollapsed={SECTION_COLLAPSE_DEFAULTS}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TasksView empty state", () => {
  // The regression this file exists for: the empty state used to render *below*
  // the three status sections rather than instead of them, so a new install
  // showed an empty list and a message telling it there was no list.
  it("replaces the status sections rather than sitting below them", () => {
    renderView([]);

    expect(screen.getByRole("heading", { name: "No tasks yet" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: /^Open/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^In Progress/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: /^Closed/ })).toBeNull();
  });

  it("shows the status sections and no empty state once a task exists", () => {
    renderView([task()]);

    expect(screen.queryByRole("heading", { name: "No tasks yet" })).toBeNull();
    expect(screen.getByRole("heading", { name: /^Open/ })).toBeDefined();
  });
});

describe("TasksView focus after the last task is deleted", () => {
  // Deleting the only task unmounts the card holding focus, and the shared
  // restore drops to `<body>`. With no section header left to land on, the
  // empty state's heading is the fallback landmark.
  it("moves focus to the empty state heading", async () => {
    const user = userEvent.setup();
    const view = renderView([task()]);

    await user.click(
      screen.getByRole("button", { name: "Actions for Rate-limit failed login attempts" })
    );
    await user.click(screen.getByRole("menuitem", { name: /Delete/ }));

    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Delete task" }));

    expect(deleteTaskAction).toHaveBeenCalledWith("t1");
    expect(refresh).toHaveBeenCalled();

    // The route would re-render the view with the refreshed list; this is that
    // re-render, and the effect keyed on `tasks` is what moves focus.
    view.rerender(
      <TasksView
        tasks={[]}
        categories={categories}
        initialSort="updated_desc"
        initialCollapsed={SECTION_COLLAPSE_DEFAULTS}
      />
    );

    const heading = document.getElementById(tasksEmptyStateHeadingId);
    expect(heading).not.toBeNull();
    expect(document.activeElement).toBe(heading);
  });
});
