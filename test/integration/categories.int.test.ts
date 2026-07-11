import { describe, it, expect } from "vitest";
import { prisma } from "@/src/server/db";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "../../app/categories/actions";

const ABSENT_ID = "cjld2cjxh0000qzrmn831i7rn";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("createCategoryAction (integration)", () => {
  it("persists a valid category and reads it back from the DB", async () => {
    const res = await createCategoryAction(null, form({ name: "Work", color: "#6366f1" }));

    expect(res.ok).toBe(true);
    const rows = await prisma.category.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Work", color: "#6366f1" });
  });

  it("rejects invalid input without writing a row", async () => {
    const res = await createCategoryAction(null, form({ name: "" }));

    expect(res.ok).toBe(false);
    expect(await prisma.category.count()).toBe(0);
  });

  it("maps a real unique-name violation to CONFLICT and writes nothing new", async () => {
    await prisma.category.create({ data: { name: "Work" } });

    const res = await createCategoryAction(null, form({ name: "Work" }));

    expect(res).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await prisma.category.count()).toBe(1);
  });
});

describe("updateCategoryAction (integration)", () => {
  it("persists a rename to the DB", async () => {
    const cat = await prisma.category.create({ data: { name: "Work" } });

    const res = await updateCategoryAction(cat.id, null, form({ name: "Home" }));

    expect(res.ok).toBe(true);
    const row = await prisma.category.findUnique({ where: { id: cat.id } });
    expect(row?.name).toBe("Home");
  });

  it("maps a missing category to NOT_FOUND", async () => {
    const res = await updateCategoryAction(ABSENT_ID, null, form({ name: "x" }));

    expect(res).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("maps a rename that collides with another name to CONFLICT", async () => {
    await prisma.category.create({ data: { name: "Existing" } });
    const cat = await prisma.category.create({ data: { name: "Work" } });

    const res = await updateCategoryAction(cat.id, null, form({ name: "Existing" }));

    expect(res).toMatchObject({ ok: false, code: "CONFLICT" });
  });
});

describe("deleteCategoryAction (integration)", () => {
  it("removes the row from the DB", async () => {
    const cat = await prisma.category.create({ data: { name: "Work" } });

    const res = await deleteCategoryAction(cat.id);

    expect(res.ok).toBe(true);
    expect(await prisma.category.count()).toBe(0);
  });

  it("maps a missing category to NOT_FOUND", async () => {
    const res = await deleteCategoryAction(ABSENT_ID);

    expect(res).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("nulls assigned tasks' categoryId on delete (schema onDelete: SetNull)", async () => {
    const cat = await prisma.category.create({ data: { name: "Work" } });
    const task = await prisma.task.create({
      data: { title: "Assigned", status: "open", categoryId: cat.id },
    });

    const res = await deleteCategoryAction(cat.id);

    expect(res.ok).toBe(true);
    expect(await prisma.category.count()).toBe(0);
    const row = await prisma.task.findUnique({ where: { id: task.id } });
    expect(row?.categoryId).toBeNull(); // task survives, its link is cleared
  });
});
