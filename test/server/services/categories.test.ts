import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

vi.mock("@/src/server/db", () => ({
  prisma: {
    category: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/src/server/db";
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/src/server/services/categories";
import { ConflictError, NotFoundError } from "@/src/server/errors";

const category = vi.mocked(prisma.category);

const categoryRow = {
  id: "c1",
  name: "Work",
  color: "#6366f1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

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
  it("maps rows to DTOs with an ISO-string createdAt (AC3)", async () => {
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
  });

  it("creates and returns a DTO (colour omitted — DB default applies)", async () => {
    category.create.mockResolvedValue(categoryRow as never);

    const result = await createCategory({ name: "Work" });

    expect(category.create).toHaveBeenCalledOnce();
    expect(result.color).toBe("#6366f1");
  });

  it("maps a duplicate name (P2002) to ConflictError", async () => {
    category.create.mockRejectedValue(prismaError("P2002"));

    await expect(createCategory({ name: "Work" })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("updateCategory", () => {
  it("updates and returns a DTO", async () => {
    category.update.mockResolvedValue({ ...categoryRow, name: "Personal" } as never);

    const result = await updateCategory("c1", { name: "Personal" });

    expect(result.name).toBe("Personal");
  });

  it("maps a missing category (P2025) to NotFoundError", async () => {
    category.update.mockRejectedValue(prismaError("P2025"));

    await expect(updateCategory("missing", { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("maps a name collision (P2002) to ConflictError", async () => {
    category.update.mockRejectedValue(prismaError("P2002"));

    await expect(updateCategory("c1", { name: "Work" })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("deleteCategory", () => {
  it("resolves when the delete succeeds", async () => {
    category.delete.mockResolvedValue(categoryRow as never);

    await expect(deleteCategory("c1")).resolves.toBeUndefined();
  });

  it("maps a missing row (P2025) to NotFoundError", async () => {
    category.delete.mockRejectedValue(prismaError("P2025"));

    await expect(deleteCategory("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});
