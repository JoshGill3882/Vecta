"use server";

import { ActionResult, toActionError } from "@/src/lib/result";
import { TaskDTO } from "@/src/lib/dtos/tasks";
import { createTask, updateTask, deleteTask } from "@/src/server/services/tasks";
import { revalidateTasks } from "@/src/lib/cache";
import { validate } from "@/src/lib/validation";
import { taskCreateSchema, taskUpdateSchema } from "@/src/lib/schemas/tasks";
import { getSession } from "@/src/lib/session";

/*
 * These take a plain object, not FormData. A Server Action is an ordinary async
 * function — Next serialises whatever you hand it — and FormData is only forced
 * on you by `useActionState`, which the task dialog doesn't use. That matters
 * here: FormData carries strings, so it has no way to say `categoryId: null`,
 * the value that clears a task's category. The category actions still take
 * FormData because `category-editor.tsx` drives them through `useActionState`.
 *
 * `input` is `unknown` deliberately. A Server Action is a public endpoint that
 * anyone can call, so the client's validation is a convenience and never a
 * guarantee — `unknown` stops the compiler letting us read a field before
 * `validate()` has vouched for it.
 */

/** Server Action for creating a Task
 *
 * @param input Untrusted candidate task fields, validated here
 * @returns ActionResult with new TaskDTO or Error
 */
export async function createTaskAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "You must be signed in", code: "UNAUTHENTICATED" };

  const result = validate(taskCreateSchema, input);
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
 * @param id ID of the Task being updated
 * @param input Untrusted candidate task fields, validated here
 * @returns ActionResult with new TaskDTO or Error
 */
export async function updateTaskAction(id: string, input: unknown): Promise<ActionResult<TaskDTO>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "You must be signed in", code: "UNAUTHENTICATED" };

  if (!id) return { ok: false, error: "Missing Task ID" };
  const result = validate(taskUpdateSchema, input);
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
