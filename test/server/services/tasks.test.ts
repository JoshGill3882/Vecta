import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

// Mock the singleton so the service runs against an in-memory fake, never a DB.
// (The seam all task DB access flows through: @/src/server/db.) The fake
// $transaction runs the array of queries it is handed, as the real one does.
vi.mock("@/src/server/db", () => ({
  prisma: {
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    task: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/src/server/logger", () => ({
  logger: { activity: { info: vi.fn() } },
}));

import { prisma } from "@/src/server/db";
import { logger } from "@/src/server/logger";
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} from "@/src/server/services/tasks";
import { NotFoundError } from "@/src/server/errors";

// Typed handles on the mocked task delegate and the activity log.
const task = vi.mocked(prisma.task);
const activity = vi.mocked(logger.activity.info);

// A raw Prisma row (Date objects, status as a plain string) — what the client returns.
const taskRow = {
  id: "t1",
  title: "Write service tests",
  description: "",
  status: "open",
  categoryId: null,
  dueAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

// Build a real Prisma error so the service's `instanceof` check actually fires.
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
        dueAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    // The DTO carries strings, not Date instances.
    expect(typeof result[0].createdAt).toBe("string");
  });

  // A due date is wall-clock text with no timezone, so it crosses unconverted:
  // turning it into an ISO timestamp would give it a timezone it never had.
  it("passes a due date through exactly as stored", async () => {
    task.findMany.mockResolvedValue([{ ...taskRow, dueAt: "2026-09-15T17:30" }] as never);

    const [result] = await getTasks();

    expect(result.dueAt).toBe("2026-09-15T17:30");
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
    expect(activity).not.toHaveBeenCalled();
  });

  it("rejects an invalid due date at the seam, before the DB", async () => {
    await expect(
      createTask({ title: "Dated", status: "open", dueAt: "2026-02-30" })
    ).rejects.toThrow();
    expect(task.create).not.toHaveBeenCalled();
  });

  it("creates and returns a DTO for valid input", async () => {
    task.create.mockResolvedValue(taskRow as never);

    const result = await createTask({ title: "Write service tests", status: "open" });

    expect(task.create).toHaveBeenCalledOnce();
    expect(result.id).toBe("t1");
  });

  it("records the new task as activity, by id and title", async () => {
    task.create.mockResolvedValue(taskRow as never);

    await createTask({ title: "Write service tests", status: "open" });

    expect(activity).toHaveBeenCalledOnce();
    expect(activity).toHaveBeenCalledWith("task.created", "Task created", {
      taskId: "t1",
      title: "Write service tests",
    });
  });

  it("maps a FK violation (P2003) on a bad categoryId to NotFoundError, recording nothing", async () => {
    task.create.mockRejectedValue(prismaError("P2003"));

    await expect(
      createTask({
        title: "Orphan",
        status: "open",
        categoryId: "cjld2cjxh0000qzrmn831i7rn",
      })
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(activity).not.toHaveBeenCalled();
  });
});

describe("updateTask", () => {
  // Each test sets the read as well as the write: a rejected read left by an
  // earlier test would otherwise fail the transaction before the write mattered.
  beforeEach(() => {
    task.findUniqueOrThrow.mockResolvedValue(taskRow as never);
  });

  it("rejects an invalid due date at the seam, before the DB", async () => {
    await expect(updateTask("t1", { dueAt: "2026-09-15T25:00" })).rejects.toThrow();
    expect(task.update).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled();
  });

  it("updates and returns a DTO", async () => {
    task.update.mockResolvedValue({ ...taskRow, title: "Renamed" } as never);

    const result = await updateTask("t1", { title: "Renamed" });

    expect(result.title).toBe("Renamed");
  });

  it("reads the task and writes it in one transaction", async () => {
    task.update.mockResolvedValue({ ...taskRow, title: "Renamed" } as never);

    await updateTask("t1", { title: "Renamed" });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(task.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(task.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { title: "Renamed" } });
  });

  it("records the fields that changed, and not the ones supplied unchanged", async () => {
    task.update.mockResolvedValue({ ...taskRow, title: "Renamed", dueAt: "2026-09-15" } as never);

    await updateTask("t1", { title: "Renamed", status: "open", dueAt: "2026-09-15" });

    expect(activity).toHaveBeenCalledOnce();
    expect(activity).toHaveBeenCalledWith("task.updated", "Task updated", {
      taskId: "t1",
      title: "Renamed",
      changed: ["title", "dueAt"],
    });
  });

  it("records a cleared field as changed", async () => {
    task.findUniqueOrThrow.mockResolvedValue({ ...taskRow, dueAt: "2026-09-15" } as never);
    task.update.mockResolvedValue(taskRow as never);

    await updateTask("t1", { dueAt: null });

    expect(activity.mock.calls[0][2]).toMatchObject({ changed: ["dueAt"] });
  });

  it("records an update that changes nothing, with an empty list", async () => {
    task.update.mockResolvedValue(taskRow as never);

    await updateTask("t1", { title: "Write service tests" });

    expect(activity.mock.calls[0][2]).toMatchObject({ changed: [] });
  });

  it("names a changed description without recording its text", async () => {
    task.update.mockResolvedValue({ ...taskRow, description: "Private notes" } as never);

    await updateTask("t1", { description: "Private notes" });

    expect(activity.mock.calls[0][2]).toMatchObject({ changed: ["description"] });
    expect(JSON.stringify(activity.mock.calls[0])).not.toContain("Private notes");
  });

  it("maps a missing task (P2025) to NotFoundError, recording nothing", async () => {
    task.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));
    task.update.mockRejectedValue(prismaError("P2025"));

    await expect(updateTask("missing", { title: "x" })).rejects.toBeInstanceOf(NotFoundError);
    expect(activity).not.toHaveBeenCalled();
  });

  it("maps a bad categoryId (P2003) to NotFoundError, recording nothing", async () => {
    task.update.mockRejectedValue(prismaError("P2003"));

    await expect(
      updateTask("t1", { categoryId: "cjld2cjxh0000qzrmn831i7rn" })
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(activity).not.toHaveBeenCalled();
  });
});

describe("deleteTask", () => {
  it("resolves when the delete succeeds", async () => {
    task.delete.mockResolvedValue(taskRow as never);

    await expect(deleteTask("t1")).resolves.toBeUndefined();
    expect(task.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
  });

  it("records the deletion with the title the task had", async () => {
    task.delete.mockResolvedValue(taskRow as never);

    await deleteTask("t1");

    expect(activity).toHaveBeenCalledOnce();
    expect(activity).toHaveBeenCalledWith("task.deleted", "Task deleted", {
      taskId: "t1",
      title: "Write service tests",
    });
  });

  it("maps a missing row (P2025) to NotFoundError instead of leaking the Prisma error", async () => {
    task.delete.mockRejectedValue(prismaError("P2025"));

    await expect(deleteTask("missing")).rejects.toBeInstanceOf(NotFoundError);
    expect(activity).not.toHaveBeenCalled();
  });
});
