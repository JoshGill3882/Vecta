"use server";

import { ActionResult, toActionError } from "@/src/lib/result";
import { TaskDTO } from "@/src/lib/dtos/tasks";
import { createTask, updateTask, deleteTask } from "@/src/server/services/tasks";
import { revalidateTasks } from "@/src/lib/cache";
import { validate } from "@/src/lib/validation";
import { taskCreateSchema, taskUpdateSchema } from "@/src/lib/schemas/tasks";
import { getSession } from "@/src/lib/session";

/** Server Action for creating a Task
 *
 * @param formData Form data from the page
 * @returns ActionResult with new TaskDTO or Error
 */
export async function createTaskAction(formData: FormData): Promise<ActionResult<TaskDTO>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "You must be signed in", code: "UNAUTHENTICATED" };

  const result = validate(taskCreateSchema, Object.fromEntries(formData));
  if (!result.success)
    return { ok: false, error: "Invalid input", fieldErrors: result.fieldErrors };

  try {
    const data = await createTask(result.data);
    revalidateTasks();
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}

/** Server Action for updating a Task
 *
 * @param id ID of the Task being deleted
 * @param formData Form Data from the Page
 * @returns ActionResult with new TaskDTO or Error
 */
export async function updateTaskAction(
  id: string,
  formData: FormData
): Promise<ActionResult<TaskDTO>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "You must be signed in", code: "UNAUTHENTICATED" };

  if (!id) return { ok: false, error: "Missing Task ID" };
  const result = validate(taskUpdateSchema, Object.fromEntries(formData));
  if (!result.success)
    return { ok: false, error: "Invalid input", fieldErrors: result.fieldErrors };

  try {
    const data = await updateTask(id, result.data);
    revalidateTasks(id);
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}

/** Server Action for deleting a Task
 *
 * @param id The ID of the Task being deleted
 * @returns ActionResult with empty content or Error
 */
export async function deleteTaskAction(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "You must be signed in", code: "UNAUTHENTICATED" };

  if (!id) return { ok: false, error: "Missing Task ID" };

  try {
    await deleteTask(id);
    revalidateTasks(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return toActionError(e);
  }
}
