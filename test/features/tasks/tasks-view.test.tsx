import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";
import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import { SECTION_COLLAPSE_DEFAULTS } from "@/src/features/tasks/lib/section-collapse";
import { tasksEmptyStateHeadingId } from "@/src/features/tasks/components/tasks-empty-state";
import { taskSectionHeaderId } from "@/src/features/tasks/components/list/task-section";

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
const updateTaskAction = vi.fn(async () => ({ ok: true as const, data: null }));
const createTaskAction = vi.fn(async () => ({ ok: true as const, data: null }));
vi.mock("@/src/features/tasks/actions", () => ({
  createTaskAction: (...args: unknown[]) => createTaskAction(...(args as [])),
  updateTaskAction: (...args: unknown[]) => updateTaskAction(...(args as [])),
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
    dueAt: null,
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

describe("TasksView delete from the task view", () => {
  const other = task({ id: "t2", title: "Rotate the session secret" });

  /** Opens the first task in the dialog and asks to delete it.
   *
   * @returns The user driving the test, the render result, and the task dialog.
   */
  async function openAndAskToDelete() {
    const user = userEvent.setup();
    const view = renderView([task(), other]);

    await user.click(screen.getByRole("button", { name: "Rate-limit failed login attempts" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    return { user, view, dialog };
  }

  it("deletes through the confirmation, closes both layers and lands focus on the section", async () => {
    const { user, view } = await openAndAskToDelete();

    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Delete task" }));

    expect(deleteTaskAction).toHaveBeenCalledWith("t1");
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    // The refreshed list, without the deleted task. The other task keeps the
    // Open section alive, so its header is the landmark rather than a fallback.
    view.rerender(
      <TasksView
        tasks={[other]}
        categories={categories}
        initialSort="updated_desc"
        initialCollapsed={SECTION_COLLAPSE_DEFAULTS}
      />
    );

    expect(document.activeElement).toBe(document.getElementById(taskSectionHeaderId("open")));
  });

  it("cancelling closes only the confirmation and returns focus to Delete", async () => {
    const { user, dialog } = await openAndAskToDelete();

    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Delete" }));
    expect(deleteTaskAction).not.toHaveBeenCalled();
  });

  it("a failed delete leaves the confirmation and the task open", async () => {
    deleteTaskAction.mockResolvedValueOnce({ ok: false, error: "Could not delete" } as never);
    const { user, dialog } = await openAndAskToDelete();

    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Delete task" }));

    await waitFor(() =>
      expect(within(confirm).getByRole("button", { name: "Delete task" })).toHaveProperty(
        "disabled",
        false
      )
    );
    expect(screen.getByRole("alertdialog")).toBe(confirm);
    // The confirmation hides the task dialog from the accessibility tree while it
    // is open, so a role query cannot see it; it must still be in the document.
    expect(dialog.isConnected).toBe(true);
    expect(within(dialog).getByText("Rate-limit failed login attempts")).toBeDefined();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("offers no delete in edit mode", async () => {
    const user = userEvent.setup();
    renderView([task()]);

    await user.click(screen.getByRole("button", { name: "Rate-limit failed login attempts" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    expect(within(dialog).getByRole("heading", { name: "Edit task" })).toBeDefined();
    expect(within(dialog).queryByRole("button", { name: /Delete/ })).toBeNull();
  });
});

describe("TasksView due filter", () => {
  // Due dates years in the past and none at all, so which option each task falls
  // in does not depend on the day the test runs.
  const late = task({ id: "t1", title: "Renew the TLS certificate", dueAt: "2020-01-01" });
  const undated = task({ id: "t2", title: "Tidy the README" });
  const lateButClosed = task({
    id: "t3",
    title: "Rotate the backup keys",
    dueAt: "2020-01-01",
    status: "closed",
  });

  it("narrows the list on its own, as search and categories do", async () => {
    const user = userEvent.setup();
    renderView([late, undated, lateButClosed]);

    await user.click(screen.getByRole("button", { name: "Due" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Overdue" }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("status").textContent).toBe("1 of 3 tasks");
    expect(screen.getByRole("button", { name: "Renew the TLS certificate" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Tidy the README" })).toBeNull();
    // A closed task is never overdue, so its section empties and drops.
    expect(screen.queryByRole("heading", { name: /^Closed/ })).toBeNull();
  });

  it("shows every selected option's tasks, not only those in all of them", async () => {
    const user = userEvent.setup();
    renderView([late, undated, lateButClosed]);

    await user.click(screen.getByRole("button", { name: "Due" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Overdue" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "No due date" }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("status").textContent).toBe("2 of 3 tasks");
  });

  it("says the due-date filter emptied the list, and clears it", async () => {
    const user = userEvent.setup();
    renderView([late, undated, lateButClosed]);

    await user.click(screen.getByRole("button", { name: "Due" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Due today" }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("heading", { name: "No matching tasks" })).toBeDefined();
    expect(screen.getByText("No tasks in the selected due dates.")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByRole("status").textContent).toBe("3 tasks across 1 category");
  });

  it("names the option as a chip, and Clear all takes the search with it", async () => {
    const user = userEvent.setup();
    renderView([late, undated, lateButClosed]);

    await user.type(screen.getByRole("searchbox", { name: "Search tasks" }), "renew");
    await user.click(screen.getByRole("button", { name: "Due" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Overdue" }));
    await user.keyboard("{Escape}");

    const chips = screen.getByRole("list", { name: "Active filters" });
    expect(within(chips).getByText("“renew”")).toBeDefined();
    expect(within(chips).getByText("Overdue")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(screen.queryByRole("list", { name: "Active filters" })).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Search tasks" })).toHaveProperty("value", "");
    expect(screen.getByRole("status").textContent).toBe("3 tasks across 1 category");
  });
});

describe("TasksView errors from a rejected save", () => {
  /** Opens the task for editing and retitles it, ready to save.
   *
   * @param title What to type over the task's title.
   * @returns The user driving the test, and the task dialog.
   */
  async function editTitle(title: string) {
    const user = userEvent.setup();
    renderView([task()]);

    await user.click(screen.getByRole("button", { name: "Rate-limit failed login attempts" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Edit" }));

    const input = within(dialog).getByRole("textbox", { name: /Title/ });
    await user.clear(input);
    if (title) await user.type(input, title);

    return { user, dialog, input };
  }

  /** Makes the next update fail the way the server reports it.
   *
   * @param error The failure's own message.
   * @param fieldErrors The field-keyed messages, if the failure has any.
   */
  function rejectNextUpdate(error: string, fieldErrors?: Record<string, string[]>) {
    updateTaskAction.mockResolvedValueOnce({ ok: false, error, fieldErrors } as never);
  }

  it("shows a field's error under that field, with no toast", async () => {
    rejectNextUpdate("Invalid input", { title: ["That title is already in use"] });
    const { user, dialog, input } = await editTitle("Rotate the session secret");

    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    const message = await within(dialog).findByText("That title is already in use");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(message.id);
    expect(document.activeElement).toBe(input);
    expect(toast.error).not.toHaveBeenCalled();
    // A rejected save keeps the form open rather than returning to view mode.
    expect(within(dialog).getByRole("heading", { name: "Edit task" })).toBeDefined();
  });

  it("clears the server's message once the field is edited", async () => {
    rejectNextUpdate("Invalid input", { title: ["That title is already in use"] });
    const { user, dialog, input } = await editTitle("Rotate the session secret");

    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await within(dialog).findByText("That title is already in use");

    await user.type(input, " again");

    expect(within(dialog).queryByText("That title is already in use")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("still reports an error that names no field, as a toast", async () => {
    rejectNextUpdate("Missing Task ID");
    const { user, dialog } = await editTitle("Rotate the session secret");

    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Missing Task ID"));
    expect(within(dialog).getByRole("heading", { name: "Edit task" })).toBeDefined();
  });

  it("reports an error for a field the form does not have, rather than dropping it", async () => {
    rejectNextUpdate("Invalid input", { priority: ["Required"] });
    const { user, dialog } = await editTitle("Rotate the session secret");

    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("priority: Required"));
  });

  it("catches what the client can check before anything is sent", async () => {
    const { user, dialog } = await editTitle("");

    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await within(dialog).findByText("Title is required")).toBeDefined();
    expect(updateTaskAction).not.toHaveBeenCalled();
  });
});

describe("TasksView saving from one dialog", () => {
  /** Retitles the task in the open form.
   *
   * @param user The user driving the test.
   * @param dialog The task dialog.
   * @param title The new title.
   */
  async function retitle(
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
    title: string
  ) {
    const input = within(dialog).getByRole("textbox", { name: /Title/ });
    await user.clear(input);
    await user.type(input, title);
  }

  it("creates a task from New task", async () => {
    const user = userEvent.setup();
    renderView([]);

    await user.click(screen.getByRole("button", { name: "New task" }));
    const dialog = await screen.findByRole("dialog");
    await retitle(user, dialog, "Rotate the session secret");
    await user.click(within(dialog).getByRole("button", { name: "Create task" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Task created"));
    expect(createTaskAction).toHaveBeenCalledTimes(1);
    expect(updateTaskAction).not.toHaveBeenCalled();
  });

  // A successful create leaves the dialog open in view mode on the new task, and
  // its Edit button reopens the form on that task. A save from there once went
  // to the create action again, writing a second task instead of changing the first.
  it("updates the task just created when it is edited without reopening", async () => {
    const created = task({ id: "t-new", title: "Rotate the session secret" });
    createTaskAction.mockResolvedValueOnce({ ok: true, data: created } as never);
    const user = userEvent.setup();
    renderView([]);

    await user.click(screen.getByRole("button", { name: "New task" }));
    const dialog = await screen.findByRole("dialog");
    await retitle(user, dialog, created.title);
    await user.click(within(dialog).getByRole("button", { name: "Create task" }));

    await user.click(await within(dialog).findByRole("button", { name: "Edit" }));
    await retitle(user, dialog, "Rotate the session secret quarterly");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateTaskAction).toHaveBeenCalledWith(
        "t-new",
        expect.objectContaining({ title: "Rotate the session secret quarterly" })
      )
    );
    expect(createTaskAction).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenLastCalledWith("Changes saved");
  });

  it("keeps updating the same task across saves from a dialog opened on it", async () => {
    const titles = ["Rate-limit login attempts", "Rate-limit every login attempt"];
    for (const title of titles) {
      updateTaskAction.mockResolvedValueOnce({ ok: true, data: task({ title }) } as never);
    }
    const user = userEvent.setup();
    renderView([task()]);

    await user.click(screen.getByRole("button", { name: "Rate-limit failed login attempts" }));
    const dialog = await screen.findByRole("dialog");

    for (const title of titles) {
      await user.click(await within(dialog).findByRole("button", { name: "Edit" }));
      await retitle(user, dialog, title);
      await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
      await waitFor(() =>
        expect(updateTaskAction).toHaveBeenLastCalledWith("t1", expect.objectContaining({ title }))
      );
    }

    expect(updateTaskAction).toHaveBeenCalledTimes(2);
    expect(createTaskAction).not.toHaveBeenCalled();
  });
});
