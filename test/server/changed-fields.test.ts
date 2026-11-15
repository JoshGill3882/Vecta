import { describe, expect, it } from "vitest";
import { changedFields } from "@/src/server/changed-fields";

const before = { title: "Buy milk", status: "open", categoryId: "c1", dueAt: null };

describe("changedFields", () => {
  it("names each supplied field whose value differs", () => {
    expect(changedFields(before, { title: "Buy oat milk", status: "closed" })).toEqual([
      "title",
      "status",
    ]);
  });

  it("leaves out a field supplied with the value it already had", () => {
    expect(changedFields(before, { title: "Buy milk", status: "closed" })).toEqual(["status"]);
  });

  it("leaves out a field that is omitted or undefined, since it is left as it was", () => {
    expect(changedFields(before, { title: undefined })).toEqual([]);
    expect(changedFields(before, {})).toEqual([]);
  });

  it("counts setting and clearing a nullable field as changes", () => {
    expect(changedFields(before, { dueAt: "2026-09-15" })).toEqual(["dueAt"]);
    expect(changedFields(before, { categoryId: null })).toEqual(["categoryId"]);
  });

  it("keeps a null that was already null unchanged", () => {
    expect(changedFields(before, { dueAt: null })).toEqual([]);
  });

  it("lists the fields in the order the update gives them", () => {
    expect(changedFields(before, { status: "closed", title: "x" })).toEqual(["status", "title"]);
  });
});
