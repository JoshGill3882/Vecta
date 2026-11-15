import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/src/server/db";
import { CATEGORY_PALETTE } from "@/src/shared/lib/palette";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/src/features/categories/actions";
import { activityEntries } from "@/test/support/activity";

// The real logger writes every entry to stdout too; keep that out of the output.
beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ABSENT_ID = "cjld2cjxh0000qzrmn831i7rn";

/** Builds form data from plain fields.
 *
 * @param fields Field names and values.
 * @returns Form data ready to submit.
 */
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

  it("falls back to a palette colour when none is supplied", async () => {
    // The schema default is what a category gets when the picker is never
    // touched, so it has to clear AA as chip text like the offered swatches
    // do. Asserting membership rather than the literal keeps this test honest
    // if the chosen swatch changes.
    const res = await createCategoryAction(null, form({ name: "Unstyled" }));

    expect(res.ok).toBe(true);
    const row = await prisma.category.findFirstOrThrow({ where: { name: "Unstyled" } });
    expect(CATEGORY_PALETTE).toContain(row.color);
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

describe("category activity (integration)", () => {
  it("records a create, a rename and a delete against the real table", async () => {
    const created = await createCategoryAction(null, form({ name: "Work", color: "#6366f1" }));
    if (!created.ok) throw new Error("create failed");
    const id = created.data.id;

    await updateCategoryAction(id, null, form({ name: "Home", color: "#6366f1" }));
    await deleteCategoryAction(id);

    expect(await activityEntries()).toEqual([
      { event: "category.created", detail: { categoryId: id, name: "Work" } },
      {
        event: "category.deleted",
        detail: { categoryId: id, name: "Home", uncategorisedTasks: 0 },
      },
      { event: "category.updated", detail: { categoryId: id, name: "Home", changed: ["name"] } },
    ]);
  });

  it("counts exactly the tasks a delete uncategorised, and no others", async () => {
    const cat = await prisma.category.create({ data: { name: "Work" } });
    const other = await prisma.category.create({ data: { name: "Home" } });
    await prisma.task.createMany({
      data: [
        { title: "One", status: "open", categoryId: cat.id },
        { title: "Two", status: "closed", categoryId: cat.id },
        { title: "Elsewhere", status: "open", categoryId: other.id },
        { title: "Loose", status: "open" },
      ],
    });

    await deleteCategoryAction(cat.id);

    const [entry] = await activityEntries();
    expect(entry.detail).toMatchObject({ uncategorisedTasks: 2 });
    expect(await prisma.task.count({ where: { categoryId: null } })).toBe(3);
  });

  it("records nothing for a change that fails", async () => {
    await prisma.category.create({ data: { name: "Existing" } });

    await createCategoryAction(null, form({ name: "Existing" }));
    await updateCategoryAction(ABSENT_ID, null, form({ name: "x" }));
    await deleteCategoryAction(ABSENT_ID);

    expect(await activityEntries()).toEqual([]);
  });
});
