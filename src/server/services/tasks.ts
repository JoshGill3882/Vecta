import type { TaskModel } from "@/generated/prisma/models";

/**
 * Task service — the seam all task DB access flows through.
 *
 * Bodies are stubbed until Phase 3 (Backend); see docs/PLAN.md §6. Signatures are
 * the contract callers (Server Actions / route handlers) build against now, and
 * are where service-action-boundary logging lands in Phase 3.
 */

/** Allowed task states. Stored as a String column for SQLite/Postgres parity. */
export type TaskStatus = "open" | "in_progress" | "closed";

export interface CreateTaskInput {
  title: string;
  description?: string;
  status: TaskStatus;
  categoryId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  categoryId?: string | null;
}

export async function getTasks(): Promise<TaskModel[]> {
  throw new Error("not implemented");
}

export async function getTaskById(id: string): Promise<TaskModel | null> {
  void id;
  throw new Error("not implemented");
}

export async function createTask(input: CreateTaskInput): Promise<TaskModel> {
  void input;
  throw new Error("not implemented");
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<TaskModel> {
  void id;
  void input;
  throw new Error("not implemented");
}

export async function deleteTask(id: string): Promise<void> {
  void id;
  throw new Error("not implemented");
}
