// DTOs relating to Tasks

import type { TaskModel } from "@/generated/prisma-sqlite/models";

// Allowed task states. Stored as a String column for SQLite/Postgres parity.
export type TaskStatus = "open" | "in_progress" | "closed";

// DTO itself
export interface TaskDTO {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  categoryId: string | null;
  createdAt: string; // ISO Date String
  updatedAt: string; // ISO Date String
}

// Conversion Helper
export function toTaskDTO(model: TaskModel): TaskDTO {
  return {
    id: model.id,
    title: model.title,
    description: model.description,
    status: model.status as TaskStatus,
    categoryId: model.categoryId,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  };
}
