import { describe, it, expect } from "vitest";

import { detailLayout } from "@/src/features/logs/lib/detail-fields";

describe("detailLayout", () => {
  it("lays out nothing for an entry with no detail", () => {
    expect(detailLayout(null)).toEqual({ fields: [], stacks: [] });
    expect(detailLayout({})).toEqual({ fields: [], stacks: [] });
  });

  it("gives each value a line, in the order the detail holds them", () => {
    expect(detailLayout({ taskId: "t1", title: "Buy milk" }).fields).toEqual([
      { name: "taskId", value: "t1" },
      { name: "title", value: "Buy milk" },
    ]);
  });

  it("shows text as recorded, without quotes, however it reads", () => {
    const title = '“Quoted” <b>bold</b> & {"json": true}';

    expect(detailLayout({ title }).fields).toEqual([{ name: "title", value: title }]);
  });

  it("shows a list as its items", () => {
    expect(detailLayout({ changed: ["title", "status"] }).fields).toEqual([
      { name: "changed", value: "title, status" },
    ]);
  });

  it("says None for an empty list", () => {
    expect(detailLayout({ changed: [] }).fields).toEqual([{ name: "changed", value: "None" }]);
  });

  it("writes a list's items that are not text as JSON", () => {
    expect(detailLayout({ ids: [1, null, { a: 1 }, "x"] }).fields).toEqual([
      { name: "ids", value: '1, null, {"a":1}, x' },
    ]);
  });

  it.each([
    ["a number", 42, "42"],
    ["zero", 0, "0"],
    ["true", true, "true"],
    ["false", false, "false"],
    ["null", null, "null"],
    ["empty text", "", ""],
    ["an empty object", {}, "{}"],
  ])("writes %s as %s", (_, value, text) => {
    expect(detailLayout({ value }).fields).toEqual([{ name: "value", value: text }]);
  });

  it("opens an object into a line per value, named by where it sits", () => {
    const detail = {
      error: { name: "PrismaClientKnownRequestError", code: "P2002", meta: { target: ["name"] } },
    };

    expect(detailLayout(detail).fields).toEqual([
      { name: "error.name", value: "PrismaClientKnownRequestError" },
      { name: "error.code", value: "P2002" },
      { name: "error.meta.target", value: "name" },
    ]);
  });

  it("keeps an error's stack apart, for a block of its own", () => {
    const stack = "TypeError: boom\n    at handler (src/x.ts:1:1)";
    const layout = detailLayout({ error: { name: "TypeError", message: "boom", stack } });

    expect(layout.fields).toEqual([
      { name: "error.name", value: "TypeError" },
      { name: "error.message", value: "boom" },
    ]);
    expect(layout.stacks).toEqual([{ name: "error.stack", value: stack }]);
  });

  it("keeps every stack, a cause's as well as the error's", () => {
    const layout = detailLayout({
      error: { stack: "Error: outer", cause: { message: "inner", stack: "Error: inner" } },
    });

    expect(layout.stacks).toEqual([
      { name: "error.stack", value: "Error: outer" },
      { name: "error.cause.stack", value: "Error: inner" },
    ]);
    expect(layout.fields).toEqual([{ name: "error.cause.message", value: "inner" }]);
  });

  it("keeps a stack at the top of the detail apart too", () => {
    expect(detailLayout({ stack: "Error: top" })).toEqual({
      fields: [],
      stacks: [{ name: "stack", value: "Error: top" }],
    });
  });

  it("leaves a field called stack among the fields when it is not text", () => {
    expect(detailLayout({ stack: ["a", "b"] })).toEqual({
      fields: [{ name: "stack", value: "a, b" }],
      stacks: [],
    });
  });

  it("only counts a field named exactly stack as a stack", () => {
    expect(detailLayout({ stackTrace: "x", callstack: "y" }).stacks).toEqual([]);
  });

  it("shows a damaged detail's text as it was stored", () => {
    expect(detailLayout({ unparsed: "{oops" }).fields).toEqual([
      { name: "unparsed", value: "{oops" },
    ]);
  });
});
