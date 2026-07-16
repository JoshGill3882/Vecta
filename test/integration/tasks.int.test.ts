import { describe, it, expect } from "vitest";
import { prisma } from "@/src/server/db";
import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
} from "../../app/(app)/tasks/actions";

// A valid, DB-shaped cuid that no row will ever own — for "missing" lookups.
const ABSENT_ID = "cjld2cjxh0000qzrmn831i7rn";

describe("createTaskAction (integration)", () => {
  it("persists a valid task and reads it back from the DB", async () => {
    const res = await createTaskAction({ title: "Real task", status: "open" });

    expect(res.ok).toBe(true);
    const rows = await prisma.task.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Real task", status: "open", categoryId: null });
  });

  it("links a new task to a real category", async () => {
    const cat = await prisma.category.create({ data: { name: "Work" } });

    const res = await createTaskAction({ title: "Assigned", status: "open", categoryId: cat.id });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.categoryId).toBe(cat.id);
  });

  it("rejects invalid input without writing a row", async () => {
    const res = await createTaskAction({ title: "", status: "open" });

    expect(res.ok).toBe(false);
    expect(await prisma.task.count()).toBe(0);
  });

  it("maps a real FK violation (unknown categoryId) to NOT_FOUND and writes nothing", async () => {
    const res = await createTaskAction({ title: "Orphan", status: "open", categoryId: ABSENT_ID });

    expect(res).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await prisma.task.count()).toBe(0);
  });
});

describe("updateTaskAction (integration)", () => {
  it("persists an update to the DB", async () => {
    const created = await prisma.task.create({ data: { title: "Before", status: "open" } });

    const res = await updateTaskAction(created.id, { title: "After" });

    expect(res.ok).toBe(true);
    const row = await prisma.task.findUnique({ where: { id: created.id } });
    expect(row?.title).toBe("After");
  });

  it("clears the category when handed an explicit null", async () => {
    const cat = await prisma.category.create({ data: { name: "Work" } });
    const created = await prisma.task.create({
      data: { title: "Filed", status: "open", categoryId: cat.id },
    });

    const res = await updateTaskAction(created.id, { categoryId: null });

    expect(res.ok).toBe(true);
    const row = await prisma.task.findUnique({ where: { id: created.id } });
    expect(row?.categoryId).toBeNull();
  });

  it("leaves the category alone when the field is omitted entirely", async () => {
    const cat = await prisma.category.create({ data: { name: "Work" } });
    const created = await prisma.task.create({
      data: { title: "Filed", status: "open", categoryId: cat.id },
    });

    // The counterpart to the test above: omitting a field must not be read as
    // "clear it", or every partial update would strip the task's category.
    const res = await updateTaskAction(created.id, { title: "Renamed" });

    expect(res.ok).toBe(true);
    const row = await prisma.task.findUnique({ where: { id: created.id } });
    expect(row?.categoryId).toBe(cat.id);
  });

  it("maps a missing task to NOT_FOUND", async () => {
    const res = await updateTaskAction(ABSENT_ID, { title: "x" });

    expect(res).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("deleteTaskAction (integration)", () => {
  it("removes the row from the DB", async () => {
    const created = await prisma.task.create({ data: { title: "Doomed", status: "open" } });

    const res = await deleteTaskAction(created.id);

    expect(res.ok).toBe(true);
    expect(await prisma.task.count()).toBe(0);
  });

  it("maps a missing task to NOT_FOUND", async () => {
    const res = await deleteTaskAction(ABSENT_ID);

    expect(res).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});
