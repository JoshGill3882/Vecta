import { TaskStatus, TaskDTO, toTaskDTO } from "@/src/shared/lib/dtos/tasks";
import { taskCreateSchema, taskUpdateSchema } from "@/src/shared/lib/schemas/tasks";
import { prisma } from "@/src/server/db";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { NotFoundError } from "@/src/server/errors";
import { logger } from "@/src/server/logger";
import { changedFields } from "@/src/server/changed-fields";

// Task service — the seam all task DB access flows through. Each change is
// recorded as an activity entry here, once it has succeeded, so every caller is
// covered without having to remember to log.

/** The fields needed to create a task. */
export interface CreateTaskInput {
  /** Short summary. Required, and trimmed before length checks. */
  title: string;
  /** Markdown body. Omitted means empty. */
  description?: string;
  /** Which section the task starts in. */
  status: TaskStatus;
  /** A category to file it under, or null for none. */
  categoryId?: string | null;
  /** When it is due (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`), or null for no due date. */
  dueAt?: string | null;
}

/** The fields that may be changed on an existing task.
 *
 * Every one is optional: an omitted field is left as it was, which is what
 * makes a partial update expressible.
 */
export interface UpdateTaskInput {
  /** Short summary. */
  title?: string;
  /** Markdown body. */
  description?: string;
  /** Which section the task appears in. */
  status?: TaskStatus;
  /** A category to file it under, or null to unfile it. */
  categoryId?: string | null;
  /** When it is due, or null for no due date. */
  dueAt?: string | null;
}

/** Gets all Tasks
 *
 * @returns List of TaskDTOs containing the found objects
 */
export async function getTasks(): Promise<TaskDTO[]> {
  const tasks = await prisma.task.findMany();
  return tasks.map((t) => toTaskDTO(t));
}

/** Get a specific Task, given an ID
 *
 * @param id ID of the Task to find
 * @returns Found Task as a DTO
 * @throws NotFoundError if not found
 */
export async function getTaskById(id: string): Promise<TaskDTO> {
  try {
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: id },
    });
    return toTaskDTO(task);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
      throw new NotFoundError("Task", id);
    }
    throw e;
  }
}

/** Create a new Task, given input parameters
 *
 * @param input Input Parameters for the new Task
 * @returns Newly created Task as a DTO
 * @throws NotFoundError if the Category provided isn't found
 */
export async function createTask(input: CreateTaskInput): Promise<TaskDTO> {
  // Defensive re-validation at the service seam: callers other than our validated
  // Server Actions (future REST routes, scripts) shouldn't be trusted to have run
  // Zod. A failure here is a caller bug, so .parse() throwing is the right signal.
  const data = taskCreateSchema.parse(input);
  try {
    const createdTask = await prisma.task.create({ data });
    logger.activity.info("task.created", "Task created", {
      taskId: createdTask.id,
      title: createdTask.title,
    });
    return toTaskDTO(createdTask);
  } catch (e) {
    // P2003 = FK constraint: the supplied categoryId points at no Category.
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2003") {
      throw new NotFoundError("Category", String(data.categoryId));
    }
    throw e;
  }
}

/** Update an existing Task, given an ID and new parameters
 *
 * @param id ID of the Task being updated
 * @param input New fields of the Task
 * @returns Updated Task as a DTO
 * @throws NotFoundError if Task doesn't exist
 */
export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskDTO> {
  const data = taskUpdateSchema.parse(input);
  try {
    // The read and the write run back to back in one transaction, so the fields
    // recorded as changed are compared against the row as it stood just before
    // this update. A missing task fails the read with the same P2025 the update
    // would have thrown.
    const [before, updatedTask] = await prisma.$transaction([
      prisma.task.findUniqueOrThrow({ where: { id: id } }),
      prisma.task.update({ where: { id: id }, data }),
    ]);
    logger.activity.info("task.updated", "Task updated", {
      taskId: updatedTask.id,
      title: updatedTask.title,
      changed: changedFields(before, data),
    });
    return toTaskDTO(updatedTask);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError) {
      // P2025 = the task itself wasn't found; P2003 = the new categoryId has no Category.
      if (e.code === "P2025") throw new NotFoundError("Task", id);
      if (e.code === "P2003") throw new NotFoundError("Category", String(data.categoryId));
    }
    throw e;
  }
}

/** Delete an existing Task, given an ID
 *
 * @param id ID of the Task to be deleted
 * @returns None
 * @throws NotFoundError if the Task ID is not found
 */
export async function deleteTask(id: string): Promise<void> {
  try {
    // The deleted row comes back, so the entry can still name what was deleted.
    const deletedTask = await prisma.task.delete({ where: { id: id } });
    logger.activity.info("task.deleted", "Task deleted", {
      taskId: deletedTask.id,
      title: deletedTask.title,
    });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
      throw new NotFoundError("Task", id);
    }
    throw e;
  }
}
