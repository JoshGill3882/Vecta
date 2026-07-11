import { TaskStatus, TaskDTO, toTaskDTO } from "@/src/lib/dtos/tasks";
import { taskCreateSchema, taskUpdateSchema } from "@/src/lib/schemas/tasks";
import { prisma } from "@/src/server/db";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { NotFoundError } from "@/src/server/errors";

// Task service — the seam all task DB access flows through.

/** Create Task Input Parameters */
export interface CreateTaskInput {
  title: string;
  description?: string;
  status: TaskStatus;
  categoryId?: string | null;
}

/** Update Task Input Parameters */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  categoryId?: string | null;
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
    const updatedTask = await prisma.task.update({
      where: { id: id },
      data,
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
    await prisma.task.delete({ where: { id: id } });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
      throw new NotFoundError("Task", id);
    }
    throw e;
  }
}
