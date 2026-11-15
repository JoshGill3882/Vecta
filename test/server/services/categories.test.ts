import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

// The fake $transaction runs the array of queries it is handed, as the real one does.
vi.mock("@/src/server/db", () => ({
  prisma: {
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    category: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/src/server/logger", () => ({
  logger: { activity: { info: vi.fn() } },
}));

import { prisma } from "@/src/server/db";
import { logger } from "@/src/server/logger";
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/src/server/services/categories";
import { ConflictError, NotFoundError } from "@/src/server/errors";

const category = vi.mocked(prisma.category);
const task = vi.mocked(prisma.task);
const activity = vi.mocked(logger.activity.info);

const categoryRow = {
  id: "c1",
  name: "Work",
  color: "#6366f1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

/** Builds the Prisma error a failing query would throw.
 *
 * @param code The Prisma error code the service branches on.
 * @returns An error of the type the service catches.
 */
function prismaError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError("mock prisma failure", {
    code,
    clientVersion: "7.8.0",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCategories", () => {
  it("maps rows to DTOs with an ISO-string createdAt", async () => {
    category.findMany.mockResolvedValue([categoryRow] as never);

    const result = await getCategories();

    expect(result).toEqual([
      { id: "c1", name: "Work", color: "#6366f1", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
  });
});

describe("getCategoryById", () => {
  it("returns the category as a DTO when found", async () => {
    category.findUniqueOrThrow.mockResolvedValue(categoryRow as never);

    const result = await getCategoryById("c1");

    expect(result.name).toBe("Work");
  });

  it("throws NotFoundError when the row is missing", async () => {
    category.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    await expect(getCategoryById("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("createCategory", () => {
  it("validates at the seam: a bad colour throws and never reaches the DB", async () => {
    await expect(createCategory({ name: "Work", color: "red" })).rejects.toThrow();
    expect(category.create).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled();
  });

  it("creates and returns a DTO (colour omitted — DB default applies)", async () => {
    category.create.mockResolvedValue(categoryRow as never);

    const result = await createCategory({ name: "Work" });

    expect(category.create).toHaveBeenCalledOnce();
    expect(result.color).toBe("#6366f1");
  });

  it("records the new category as activity, by id and name", async () => {
    category.create.mockResolvedValue(categoryRow as never);

    await createCategory({ name: "Work" });

    expect(activity).toHaveBeenCalledOnce();
    expect(activity).toHaveBeenCalledWith("category.created", "Category created", {
      categoryId: "c1",
      name: "Work",
    });
  });

  it("maps a duplicate name (P2002) to ConflictError, recording nothing", async () => {
    category.create.mockRejectedValue(prismaError("P2002"));

    await expect(createCategory({ name: "Work" })).rejects.toBeInstanceOf(ConflictError);
    expect(activity).not.toHaveBeenCalled();
  });
});

describe("updateCategory", () => {
  // Each test sets the read as well as the write: a rejected read left by an
  // earlier test would otherwise fail the transaction before the write mattered.
  beforeEach(() => {
    category.findUniqueOrThrow.mockResolvedValue(categoryRow as never);
  });

  it("updates and returns a DTO", async () => {
    category.update.mockResolvedValue({ ...categoryRow, name: "Personal" } as never);

    const result = await updateCategory("c1", { name: "Personal" });

    expect(result.name).toBe("Personal");
  });

  it("reads the category and writes it in one transaction", async () => {
    category.update.mockResolvedValue({ ...categoryRow, name: "Personal" } as never);

    await updateCategory("c1", { name: "Personal" });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(category.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "c1" } });
    expect(category.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { name: "Personal" },
    });
  });

  it("records the new name and the fields that changed", async () => {
    category.update.mockResolvedValue({ ...categoryRow, name: "Personal" } as never);

    await updateCategory("c1", { name: "Personal", color: "#6366f1" });

    expect(activity).toHaveBeenCalledOnce();
    expect(activity).toHaveBeenCalledWith("category.updated", "Category updated", {
      categoryId: "c1",
      name: "Personal",
      changed: ["name"],
    });
  });

  it("records a recolour as a change to color alone", async () => {
    category.update.mockResolvedValue({ ...categoryRow, color: "#22c55e" } as never);

    await updateCategory("c1", { color: "#22c55e" });

    expect(activity.mock.calls[0][2]).toMatchObject({ name: "Work", changed: ["color"] });
  });

  it("maps a missing category (P2025) to NotFoundError, recording nothing", async () => {
    category.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));
    category.update.mockRejectedValue(prismaError("P2025"));

    await expect(updateCategory("missing", { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    expect(activity).not.toHaveBeenCalled();
  });

  it("maps a name collision (P2002) to ConflictError, recording nothing", async () => {
    category.update.mockRejectedValue(prismaError("P2002"));

    await expect(updateCategory("c1", { name: "Work" })).rejects.toBeInstanceOf(ConflictError);
    expect(activity).not.toHaveBeenCalled();
  });
});

describe("deleteCategory", () => {
  it("resolves when the delete succeeds", async () => {
    task.count.mockResolvedValue(0 as never);
    category.delete.mockResolvedValue(categoryRow as never);

    await expect(deleteCategory("c1")).resolves.toBeUndefined();
  });

  it("counts the category's tasks and deletes it in one transaction", async () => {
    task.count.mockResolvedValue(0 as never);
    category.delete.mockResolvedValue(categoryRow as never);

    await deleteCategory("c1");

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(task.count).toHaveBeenCalledWith({ where: { categoryId: "c1" } });
    expect(category.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("records the deletion with the name it had and how many tasks it uncategorised", async () => {
    task.count.mockResolvedValue(3 as never);
    category.delete.mockResolvedValue(categoryRow as never);

    await deleteCategory("c1");

    expect(activity).toHaveBeenCalledOnce();
    expect(activity).toHaveBeenCalledWith("category.deleted", "Category deleted", {
      categoryId: "c1",
      name: "Work",
      uncategorisedTasks: 3,
    });
  });

  it("maps a missing row (P2025) to NotFoundError, recording nothing", async () => {
    task.count.mockResolvedValue(0 as never);
    category.delete.mockRejectedValue(prismaError("P2025"));

    await expect(deleteCategory("missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(activity).not.toHaveBeenCalled();
  });
});
