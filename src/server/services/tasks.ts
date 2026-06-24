import { TaskStatus, TaskDTO, toTaskDTO } from "@/src/lib/dtos/tasks";
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
 */
export async function createTask(input: CreateTaskInput): Promise<TaskDTO> {
  const createdTask = await prisma.task.create({ data: input });
  return toTaskDTO(createdTask);
}

/** Update an existing Task, given an ID and new parameters
 *
 * @param id ID of the Task being updated
 * @param input New fields of the Task
 * @returns Updated Task as a DTO
 * @throws NotFoundError if Task doesn't exist
 */
export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskDTO> {
  try {
    const updatedTask = await prisma.task.update({
      where: { id: id },
      data: input,
    });
    return toTaskDTO(updatedTask);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
      throw new NotFoundError("Task", id);
    }
    throw e;
  }
}

/** Delete an existing Task, given an ID
 *
 * @param id ID of the Task to be deleted
 */
export async function deleteTask(id: string): Promise<void> {
  await prisma.task.delete({ where: { id: id } });
}
