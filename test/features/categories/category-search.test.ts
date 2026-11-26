import { describe, it, expect } from "vitest";

import type { CategoryDTO } from "@/src/shared/lib/dtos/categories";
import { narrowCategories } from "@/src/features/categories/lib/category-search";

/** Builds a category fixture.
 *
 * @param id Tells two fixtures apart in an assertion.
 * @param name The only field the search reads.
 * @returns A complete category, filler included, so the fixture is a real DTO
 *   rather than a partial cast into place.
 */
function category(id: string, name: string): CategoryDTO {
  return { id, name, createdAt: "2026-01-01T00:00:00.000Z", color: "#3b9eff" };
}

const categories = [
  category("c1", "Frontend"),
  category("c2", "Backend"),
  category("c3", "Personal"),
  category("c4", "Infrastructure"),
];

/** The ids of a list, for comparing which categories it holds and in what order.
 *
 * @param list The categories to read.
 * @returns Their ids, in the list's order.
 */
function ids(list: CategoryDTO[]): string[] {
  return list.map((item) => item.id);
}

describe("narrowCategories", () => {
  it("keeps the categories whose name holds the search, in their order", () => {
    expect(ids(narrowCategories(categories, "end", null))).toEqual(["c1", "c2"]);
  });

  it("matches whatever the name's case", () => {
    expect(ids(narrowCategories(categories, "infra", null))).toEqual(["c4"]);
  });

  it("matches mid-word, not only at the start of a name", () => {
    expect(ids(narrowCategories(categories, "rson", null))).toEqual(["c3"]);
  });

  it("matches nothing when no name holds the search", () => {
    expect(narrowCategories(categories, "invoices", null)).toEqual([]);
  });

  it("returns the list itself when there is no search", () => {
    expect(narrowCategories(categories, "", null)).toBe(categories);
  });

  it("keeps the category it is told to, even when its name does not match", () => {
    expect(ids(narrowCategories(categories, "end", "c3"))).toEqual(["c1", "c2", "c3"]);
  });

  it("keeps that category in its place, not at the end", () => {
    expect(ids(narrowCategories(categories, "infra", "c2"))).toEqual(["c2", "c4"]);
  });

  it("lists a kept category that also matches only once", () => {
    expect(ids(narrowCategories(categories, "end", "c1"))).toEqual(["c1", "c2"]);
  });

  it("ignores a kept id that names no category", () => {
    expect(ids(narrowCategories(categories, "end", "gone"))).toEqual(["c1", "c2"]);
  });
});
