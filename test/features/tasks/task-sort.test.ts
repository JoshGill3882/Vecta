import { describe, it, expect } from "vitest";

import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";
import {
  DEFAULT_TASK_SORT,
  isTaskSort,
  sortTasks,
  TASK_SORTS,
} from "@/src/features/tasks/lib/task-sort";

/** Builds a task fixture.
 *
 * @param id Identifies the task in an assertion.
 * @param title The title, which the title orders read.
 * @param updatedAt An ISO timestamp, which the recency orders read.
 * @returns A complete task, filler included, so the fixture is a real DTO.
 */
function task(id: string, title: string, updatedAt: string): TaskDTO {
  return {
    id,
    title,
    description: "",
    status: "open",
    categoryId: null,
    dueAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
  };
}

const older = task("older", "Banana", "2026-01-01T00:00:00.000Z");
const newer = task("newer", "apple", "2026-06-01T00:00:00.000Z");
const newest = task("newest", "Cherry", "2026-09-01T00:00:00.000Z");
const tasks = [older, newer, newest];

describe("sortTasks", () => {
  it("puts the most recently updated first by default", () => {
    expect(sortTasks(tasks, "updated_desc").map((t) => t.id)).toEqual(["newest", "newer", "older"]);
  });

  it("reverses that for oldest first", () => {
    expect(sortTasks(tasks, "updated_asc").map((t) => t.id)).toEqual(["older", "newer", "newest"]);
  });

  it("orders by title, ignoring case", () => {
    // A plain `<` puts every capital first, so `Banana` would precede `apple`.
    expect(sortTasks(tasks, "title_asc").map((t) => t.title)).toEqual([
      "apple",
      "Banana",
      "Cherry",
    ]);
  });

  it("reverses that for Z to A", () => {
    expect(sortTasks(tasks, "title_desc").map((t) => t.title)).toEqual([
      "Cherry",
      "Banana",
      "apple",
    ]);
  });

  it("orders by title rather than by anything else", () => {
    // Both title orders once read `updatedAt`, which typechecks because every
    // operand is a string and produces an order unrelated to the titles.
    const byTitle = sortTasks(tasks, "title_asc").map((t) => t.id);
    const byRecency = sortTasks(tasks, "updated_desc").map((t) => t.id);
    expect(byTitle).not.toEqual(byRecency);
    expect(byTitle).toEqual(["newer", "older", "newest"]);
  });

  it("distinguishes the two title directions", () => {
    // `title_desc` once duplicated `updated_desc`, so Z-A silently did nothing.
    expect(sortTasks(tasks, "title_desc").map((t) => t.id)).toEqual(
      sortTasks(tasks, "title_asc")
        .map((t) => t.id)
        .reverse()
    );
  });

  it("leaves the input untouched", () => {
    sortTasks(tasks, "title_asc");
    expect(tasks.map((t) => t.id)).toEqual(["older", "newer", "newest"]);
  });

  it("handles an empty list and a single task", () => {
    expect(sortTasks([], "title_asc")).toEqual([]);
    expect(sortTasks([newer], "updated_desc")).toEqual([newer]);
  });
});

describe("sortTasks by due date", () => {
  /** A task due at a given time, updated at a given moment.
   *
   * @param id Identifies the task in an assertion.
   * @param dueAt The due date, or null for none.
   * @param updatedAt When it was last updated, for tie-breaks.
   * @returns A complete task.
   */
  function due(id: string, dueAt: string | null, updatedAt = "2026-01-01T00:00:00.000Z") {
    return { ...task(id, id, updatedAt), dueAt };
  }

  it("puts the soonest due first", () => {
    const list = [due("later", "2026-10-09"), due("sooner", "2026-09-28")];
    expect(sortTasks(list, "due_asc").map((t) => t.id)).toEqual(["sooner", "later"]);
  });

  // A date with no time is due at the end of its day, after any time on it.
  it("puts a date-only due date after a timed one on the same day", () => {
    const list = [due("all-day", "2026-09-28"), due("evening", "2026-09-28T21:00")];
    expect(sortTasks(list, "due_asc").map((t) => t.id)).toEqual(["evening", "all-day"]);
  });

  // An absent date is not an early one.
  it("puts tasks with no due date last", () => {
    const list = [due("none", null), due("far", "2030-01-01"), due("near", "2026-09-28")];
    expect(sortTasks(list, "due_asc").map((t) => t.id)).toEqual(["near", "far", "none"]);
  });

  it("breaks ties by most recently updated", () => {
    const list = [
      due("stale", "2026-09-28", "2026-01-01T00:00:00.000Z"),
      due("fresh", "2026-09-28", "2026-06-01T00:00:00.000Z"),
      due("stale-none", null, "2026-01-01T00:00:00.000Z"),
      due("fresh-none", null, "2026-06-01T00:00:00.000Z"),
    ];
    expect(sortTasks(list, "due_asc").map((t) => t.id)).toEqual([
      "fresh",
      "stale",
      "fresh-none",
      "stale-none",
    ]);
  });

  it("is offered in the menu as Due soonest", () => {
    expect(TASK_SORTS.find((sort) => sort.id === "due_asc")?.label).toBe("Due soonest");
  });
});

describe("isTaskSort", () => {
  it("accepts every order the menu offers", () => {
    for (const sort of TASK_SORTS) expect(isTaskSort(sort.id)).toBe(true);
  });

  it("rejects an order this version does not have", () => {
    // A stored preference survives deploys, so it can name an order that was
    // removed — the case that decides whether a downgrade falls back or breaks.
    expect(isTaskSort("created_desc")).toBe(false);
  });

  it("rejects anything that is not a string", () => {
    // The stored value is parsed JSON, so it can be any shape at all.
    for (const value of [null, undefined, 42, {}, [], true]) {
      expect(isTaskSort(value)).toBe(false);
    }
  });
});

describe("the default order", () => {
  it("is one the menu offers", () => {
    expect(isTaskSort(DEFAULT_TASK_SORT)).toBe(true);
  });

  it("is the first option, so the menu opens on the current choice", () => {
    expect(TASK_SORTS[0].id).toBe(DEFAULT_TASK_SORT);
  });
});
