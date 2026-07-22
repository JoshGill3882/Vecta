// DTOs relating to Categories

import type { CategoryModel } from "@/generated/prisma-sqlite/models";

// DTO itself
export interface CategoryDTO {
  id: string;
  name: string;
  createdAt: string; // ISO String Date
  color: string;
}

// Model > DTO Converter
export function toCategoryDTO(model: CategoryModel): CategoryDTO {
  return {
    id: model.id,
    name: model.name,
    createdAt: model.createdAt.toISOString(),
    color: model.color,
  };
}
