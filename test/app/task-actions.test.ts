import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotFoundError } from "@/src/server/errors";

// ── Fakes for the action's collaborators ────────────────────────────────────
// vi.mock is hoisted above the imports, so these stand in before the actions
// (and the modules they pull in) load. We keep `validate` + the Zod schemas AND
// the real src/lib/cache helper REAL, so the tests exercise the genuine
// validation gate and the real tag-invalidation logic. Only the true side
// effects are faked: auth (getSession), the service, and next/cache's updateTag
// (the primitive src/lib/cache calls under the hood).

vi.mock("@/src/lib/session", () => ({
  // The action calls getSession() first; a truthy value = "signed in", null = not.
  getSession: vi.fn(async () => ({ isLoggedIn: true })),
}));

vi.mock("@/src/server/services/tasks", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

// src/lib/cache.ts runs for real; only the Next primitive it calls is faked, so
// we can assert the exact tags (and the create-vs-update/delete distinction).
vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
}));

import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
} from "../../app/(app)/tasks/actions";
import { getSession } from "@/src/lib/session";
import { createTask, updateTask, deleteTask } from "@/src/server/services/tasks";
import { updateTag } from "next/cache";

const mockGetSession = vi.mocked(getSession);
const mockCreateTask = vi.mocked(createTask);
const mockUpdateTask = vi.mocked(updateTask);
const mockDeleteTask = vi.mocked(deleteTask);
const mockUpdateTag = vi.mocked(updateTag);

// A DTO the service returns on the happy path (ISO-string dates, never Date models).
const taskDTO = {
  id: "t1",
  title: "Write action tests",
  description: "",
  status: "open" as const,
  categoryId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

// Every valid create needs a title + a legal status enum value. The actions take
// a plain object, so these go straight in — no FormData round-trip to fake.
const validCreate = { title: "Write action tests", status: "open" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ isLoggedIn: true } as never);
});

describe("createTaskAction", () => {
  it("gates on the session before doing anything", async () => {
    mockCreateTask.mockResolvedValue(taskDTO);

    await createTaskAction(validCreate);

    expect(mockGetSession).toHaveBeenCalledOnce();
  });

  it("returns { ok: false, code: UNAUTHENTICATED } when signed out — never throws, never touches the service", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await createTaskAction(validCreate);

    expect(result).toEqual({
      ok: false,
      error: "You must be signed in",
      code: "UNAUTHENTICATED",
    });
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("invalid input returns a structured error and never reaches the service", async () => {
    const result = await createTaskAction({ title: "", status: "open" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toBe("Invalid input");
    expect(result.fieldErrors?.title).toBeDefined();
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("valid input wraps the service and returns { ok: true, data }", async () => {
    mockCreateTask.mockResolvedValue(taskDTO);

    const result = await createTaskAction(validCreate);

    expect(mockCreateTask).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, data: taskDTO });
  });

  it("a new task invalidates only the list tag — there is no detail entry to bust yet", async () => {
    mockCreateTask.mockResolvedValue(taskDTO);

    await createTaskAction(validCreate);

    expect(mockUpdateTag).toHaveBeenCalledWith("tasks");
    expect(mockUpdateTag).toHaveBeenCalledTimes(1); // no `task-<id>` on create
  });

  it("a DomainError from the service becomes { ok: false, error, code } — never thrown", async () => {
    mockCreateTask.mockRejectedValue(new NotFoundError("Category", "c-missing"));

    const result = await createTaskAction({
      title: "Orphan",
      status: "open",
      categoryId: "cjld2cjxh0000qzrmn831i7rn",
    });

    expect(result).toEqual({
      ok: false,
      error: "Category with id c-missing was not found",
      code: "NOT_FOUND",
    });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("an unexpected error is swallowed into a generic message, not surfaced or thrown", async () => {
    mockCreateTask.mockRejectedValue(new Error("boom — DB down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createTaskAction(validCreate);

    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    errSpy.mockRestore();
  });
});

describe("updateTaskAction", () => {
  it("returns UNAUTHENTICATED when signed out", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await updateTaskAction("t1", { title: "x" });

    expect(result).toEqual({
      ok: false,
      error: "You must be signed in",
      code: "UNAUTHENTICATED",
    });
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("a missing id short-circuits before validation or the service", async () => {
    const result = await updateTaskAction("", { title: "x" });

    expect(result).toEqual({ ok: false, error: "Missing Task ID" });
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("invalid input returns field errors and skips the service", async () => {
    const result = await updateTaskAction("t1", { status: "not-a-status" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.fieldErrors?.status).toBeDefined();
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("a valid update wraps the service and returns the DTO", async () => {
    mockUpdateTask.mockResolvedValue({ ...taskDTO, title: "Renamed" });

    const result = await updateTaskAction("t1", { title: "Renamed" });

    expect(mockUpdateTask).toHaveBeenCalledWith("t1", { title: "Renamed" });
    expect(result).toEqual({ ok: true, data: { ...taskDTO, title: "Renamed" } });
  });

  it("carries an explicit null categoryId through to the service, unassigning the task", async () => {
    mockUpdateTask.mockResolvedValue({ ...taskDTO, categoryId: null });

    await updateTaskAction("t1", { title: "Unfiled", categoryId: null });

    // null and "field omitted" mean different things to the service: null clears
    // the column, undefined leaves it alone. Passing the input as an object is
    // what keeps them distinguishable — FormData carries strings, so it could
    // only ever say "omitted", and clearing a category was impossible.
    expect(mockUpdateTask).toHaveBeenCalledWith("t1", { title: "Unfiled", categoryId: null });
  });

  it("an update invalidates both the list and the task's own detail tag", async () => {
    mockUpdateTask.mockResolvedValue({ ...taskDTO, title: "Renamed" });

    await updateTaskAction("t1", { title: "Renamed" });

    expect(mockUpdateTag).toHaveBeenCalledWith("tasks");
    expect(mockUpdateTag).toHaveBeenCalledWith("task-t1");
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
  });

  it("a NotFoundError on a missing task is returned, not thrown", async () => {
    mockUpdateTask.mockRejectedValue(new NotFoundError("Task", "missing"));

    const result = await updateTaskAction("missing", { title: "x" });

    expect(result).toEqual({
      ok: false,
      error: "Task with id missing was not found",
      code: "NOT_FOUND",
    });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});

describe("deleteTaskAction", () => {
  it("returns UNAUTHENTICATED when signed out", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await deleteTaskAction("t1");

    expect(result).toEqual({
      ok: false,
      error: "You must be signed in",
      code: "UNAUTHENTICATED",
    });
    expect(mockDeleteTask).not.toHaveBeenCalled();
  });

  it("a missing id short-circuits before the service", async () => {
    const result = await deleteTaskAction("");

    expect(result).toEqual({ ok: false, error: "Missing Task ID" });
    expect(mockDeleteTask).not.toHaveBeenCalled();
  });

  it("a successful delete returns { ok: true }", async () => {
    mockDeleteTask.mockResolvedValue(undefined);

    const result = await deleteTaskAction("t1");

    expect(mockDeleteTask).toHaveBeenCalledWith("t1");
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it("a delete invalidates the list and the deleted task's detail tag (so it stops rendering a ghost)", async () => {
    mockDeleteTask.mockResolvedValue(undefined);

    await deleteTaskAction("t1");

    expect(mockUpdateTag).toHaveBeenCalledWith("tasks");
    expect(mockUpdateTag).toHaveBeenCalledWith("task-t1");
    expect(mockUpdateTag).toHaveBeenCalledTimes(2);
  });

  it("a NotFoundError is returned, and nothing is invalidated on failure", async () => {
    mockDeleteTask.mockRejectedValue(new NotFoundError("Task", "missing"));

    const result = await deleteTaskAction("missing");

    expect(result).toEqual({
      ok: false,
      error: "Task with id missing was not found",
      code: "NOT_FOUND",
    });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});
