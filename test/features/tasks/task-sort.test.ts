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
