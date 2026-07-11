import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConflictError, NotFoundError } from "@/src/server/errors";

// See test/app/task-actions.test.ts for the rationale: real validate()/schemas
// and the real src/lib/cache helper; faked auth + service + next/cache updateTag.
// Categories additionally bust the "tasks" tag (a task row renders its category).

vi.mock("@/src/lib/session", () => ({
  getSession: vi.fn(async () => ({ isLoggedIn: true })),
}));

vi.mock("@/src/server/services/categories", () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
}));

import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "../../app/categories/actions";
import { getSession } from "@/src/lib/session";
import { createCategory, updateCategory, deleteCategory } from "@/src/server/services/categories";
import { updateTag } from "next/cache";

const mockGetSession = vi.mocked(getSession);
const mockCreateCategory = vi.mocked(createCategory);
const mockUpdateCategory = vi.mocked(updateCategory);
const mockDeleteCategory = vi.mocked(deleteCategory);
const mockUpdateTag = vi.mocked(updateTag);

const categoryDTO = {
  id: "c1",
  name: "Work",
  color: "#6366f1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const validCreate = { name: "Work", color: "#6366f1" };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ isLoggedIn: true } as never);
});

describe("createCategoryAction", () => {
  it("gates on the session before doing anything", async () => {
    mockCreateCategory.mockResolvedValue(categoryDTO);

    await createCategoryAction(null, form(validCreate));

    expect(mockGetSession).toHaveBeenCalledOnce();
  });

  it("returns { ok: false, code: UNAUTHENTICATED } when signed out — never throws, never touches the service", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await createCategoryAction(null, form(validCreate));

    expect(result).toEqual({
      ok: false,
      error: "You must be signed in",
      code: "UNAUTHENTICATED",
    });
    expect(mockCreateCategory).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("an empty name returns field errors and never reaches the service", async () => {
    const result = await createCategoryAction(null, form({ name: "" }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.fieldErrors?.name).toBeDefined();
    expect(mockCreateCategory).not.toHaveBeenCalled();
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("a 3-digit hex colour is rejected before the service", async () => {
    const result = await createCategoryAction(null, form({ name: "Work", color: "#fff" }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.fieldErrors?.color).toBeDefined();
    expect(mockCreateCategory).not.toHaveBeenCalled();
  });

  it("valid input wraps the service and returns { ok: true, data }", async () => {
    mockCreateCategory.mockResolvedValue(categoryDTO);

    const result = await createCategoryAction(null, form(validCreate));

    expect(mockCreateCategory).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, data: categoryDTO });
  });

  it("ignores the previous state — each submit recomputes the result from scratch", async () => {
    mockCreateCategory.mockResolvedValue(categoryDTO);
    const stalePrev = { ok: false as const, error: "old error" };

    const result = await createCategoryAction(stalePrev, form(validCreate));

    expect(result).toEqual({ ok: true, data: categoryDTO });
  });

  it("a new category invalidates the category list and the tasks list — but no `category-<id>` yet", async () => {
    mockCreateCategory.mockResolvedValue(categoryDTO);

    await createCategoryAction(null, form(validCreate));

    expect(mockUpdateTag).toHaveBeenCalledWith("categories");
    expect(mockUpdateTag).toHaveBeenCalledWith("tasks"); // task rows render category name/colour
    expect(mockUpdateTag).toHaveBeenCalledTimes(2); // no `category-<id>` on create
  });

  it("a ConflictError (duplicate name) is returned as { ok: false, error, code }", async () => {
    mockCreateCategory.mockRejectedValue(
      new ConflictError('A category named "Work" already exists')
    );

    const result = await createCategoryAction(null, form(validCreate));

    expect(result).toEqual({
      ok: false,
      error: 'A category named "Work" already exists',
      code: "CONFLICT",
    });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });

  it("an unexpected error is swallowed into a generic message, not thrown", async () => {
    mockCreateCategory.mockRejectedValue(new Error("boom"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createCategoryAction(null, form(validCreate));

    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    errSpy.mockRestore();
  });
});

describe("updateCategoryAction", () => {
  it("returns UNAUTHENTICATED when signed out", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await updateCategoryAction("c1", null, form({ name: "x" }));

    expect(result).toEqual({
      ok: false,
      error: "You must be signed in",
      code: "UNAUTHENTICATED",
    });
    expect(mockUpdateCategory).not.toHaveBeenCalled();
  });

  it("a missing id short-circuits before validation or the service", async () => {
    const result = await updateCategoryAction("", null, form({ name: "x" }));

    expect(result).toEqual({ ok: false, error: "Missing Category ID" });
    expect(mockUpdateCategory).not.toHaveBeenCalled();
  });

  it("a valid update wraps the service and returns the DTO", async () => {
    mockUpdateCategory.mockResolvedValue({ ...categoryDTO, name: "Home" });

    const result = await updateCategoryAction("c1", null, form({ name: "Home" }));

    expect(mockUpdateCategory).toHaveBeenCalledWith("c1", { name: "Home" });
    expect(result).toEqual({ ok: true, data: { ...categoryDTO, name: "Home" } });
  });

  it("an update invalidates the category list, the category's own tag, and the tasks list", async () => {
    mockUpdateCategory.mockResolvedValue({ ...categoryDTO, name: "Home" });

    await updateCategoryAction("c1", null, form({ name: "Home" }));

    expect(mockUpdateTag).toHaveBeenCalledWith("categories");
    expect(mockUpdateTag).toHaveBeenCalledWith("category-c1");
    expect(mockUpdateTag).toHaveBeenCalledWith("tasks");
    expect(mockUpdateTag).toHaveBeenCalledTimes(3);
  });

  it("a NotFoundError on a missing category is returned, not thrown", async () => {
    mockUpdateCategory.mockRejectedValue(new NotFoundError("Category", "missing"));

    const result = await updateCategoryAction("missing", null, form({ name: "x" }));

    expect(result).toEqual({
      ok: false,
      error: "Category with id missing was not found",
      code: "NOT_FOUND",
    });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});

describe("deleteCategoryAction", () => {
  it("returns UNAUTHENTICATED when signed out", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await deleteCategoryAction("c1");

    expect(result).toEqual({
      ok: false,
      error: "You must be signed in",
      code: "UNAUTHENTICATED",
    });
    expect(mockDeleteCategory).not.toHaveBeenCalled();
  });

  it("a missing id short-circuits before the service", async () => {
    const result = await deleteCategoryAction("");

    expect(result).toEqual({ ok: false, error: "Missing Category ID" });
    expect(mockDeleteCategory).not.toHaveBeenCalled();
  });

  it("a successful delete returns { ok: true }", async () => {
    mockDeleteCategory.mockResolvedValue(undefined);

    const result = await deleteCategoryAction("c1");

    expect(mockDeleteCategory).toHaveBeenCalledWith("c1");
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it("a delete invalidates the category list, the category's tag, and the tasks list", async () => {
    mockDeleteCategory.mockResolvedValue(undefined);

    await deleteCategoryAction("c1");

    expect(mockUpdateTag).toHaveBeenCalledWith("categories");
    expect(mockUpdateTag).toHaveBeenCalledWith("category-c1");
    expect(mockUpdateTag).toHaveBeenCalledWith("tasks");
    expect(mockUpdateTag).toHaveBeenCalledTimes(3);
  });

  it("a NotFoundError is returned, and nothing is invalidated on failure", async () => {
    mockDeleteCategory.mockRejectedValue(new NotFoundError("Category", "missing"));

    const result = await deleteCategoryAction("missing");

    expect(result).toEqual({
      ok: false,
      error: "Category with id missing was not found",
      code: "NOT_FOUND",
    });
    expect(mockUpdateTag).not.toHaveBeenCalled();
  });
});
