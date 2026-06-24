// DTOs relating to Tasks

import { TaskModel } from "@/generated/prisma/models";
import { TaskStatus } from "@/src/server/services/tasks";

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
