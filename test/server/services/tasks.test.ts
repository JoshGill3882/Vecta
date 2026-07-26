import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

// Mock the singleton so the service runs against an in-memory fake, never a DB.
// (The seam all task DB access flows through: @/src/server/db.)
vi.mock("@/src/server/db", () => ({
  prisma: {
    task: {
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
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} from "@/src/server/services/tasks";
import { NotFoundError } from "@/src/server/errors";

// Typed handle on the mocked task delegate.
const task = vi.mocked(prisma.task);

// A raw Prisma row (Date objects, status as a plain string) — what the client returns.
const taskRow = {
  id: "t1",
  title: "Write service tests",
  description: "",
  status: "open",
  categoryId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

// Build a real Prisma error so the service's `instanceof` check actually fires.
function prismaError(code: string): PrismaClientKnownRequestError {
  return new PrismaClientKnownRequestError("mock prisma failure", {
    code,
    clientVersion: "7.8.0",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTasks", () => {
  it("maps every row to a DTO (Dates become ISO strings, never raw models)", async () => {
    task.findMany.mockResolvedValue([taskRow] as never);

    const result = await getTasks();

    expect(task.findMany).toHaveBeenCalledOnce();
    expect(result).toEqual([
      {
        id: "t1",
        title: "Write service tests",
        description: "",
        status: "open",
        categoryId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    // The DTO carries strings, not Date instances.
    expect(typeof result[0].createdAt).toBe("string");
  });
});

describe("getTaskById", () => {
  it("returns the task as a DTO when found", async () => {
    task.findUniqueOrThrow.mockResolvedValue(taskRow as never);

    const result = await getTaskById("t1");

    expect(task.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(result.id).toBe("t1");
  });

  it("throws NotFoundError (not a raw Prisma error) when the row is missing", async () => {
    task.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    await expect(getTaskById("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("re-throws unexpected (non-P2025) Prisma errors unchanged", async () => {
    task.findUniqueOrThrow.mockRejectedValue(prismaError("P1001")); // can't reach DB

    await expect(getTaskById("t1")).rejects.toBeInstanceOf(PrismaClientKnownRequestError);
  });
});

describe("createTask", () => {
  it("validates at the seam: invalid input throws and never reaches the DB", async () => {
    await expect(createTask({ title: "", status: "open" })).rejects.toThrow();
    expect(task.create).not.toHaveBeenCalled();
  });

  it("creates and returns a DTO for valid input", async () => {
    task.create.mockResolvedValue(taskRow as never);

    const result = await createTask({ title: "Write service tests", status: "open" });

    expect(task.create).toHaveBeenCalledOnce();
    expect(result.id).toBe("t1");
  });

  it("maps a FK violation (P2003) on a bad categoryId to NotFoundError", async () => {
    task.create.mockRejectedValue(prismaError("P2003"));

    await expect(
      createTask({
        title: "Orphan",
        status: "open",
        categoryId: "cjld2cjxh0000qzrmn831i7rn",
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updateTask", () => {
  it("updates and returns a DTO", async () => {
    task.update.mockResolvedValue({ ...taskRow, title: "Renamed" } as never);

    const result = await updateTask("t1", { title: "Renamed" });

    expect(result.title).toBe("Renamed");
  });

  it("maps a missing task (P2025) to NotFoundError", async () => {
    task.update.mockRejectedValue(prismaError("P2025"));

    await expect(updateTask("missing", { title: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("maps a bad categoryId (P2003) to NotFoundError", async () => {
    task.update.mockRejectedValue(prismaError("P2003"));

    await expect(
      updateTask("t1", { categoryId: "cjld2cjxh0000qzrmn831i7rn" })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("deleteTask", () => {
  it("resolves when the delete succeeds", async () => {
    task.delete.mockResolvedValue(taskRow as never);

    await expect(deleteTask("t1")).resolves.toBeUndefined();
    expect(task.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
  });

  it("maps a missing row (P2025) to NotFoundError instead of leaking the Prisma error", async () => {
    task.delete.mockRejectedValue(prismaError("P2025"));

    await expect(deleteTask("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});
