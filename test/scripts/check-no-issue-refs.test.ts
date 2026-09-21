import { describe, it, expect } from "vitest";

import { commentsIn, issueRefsIn } from "../../scripts/check-no-issue-refs.mjs";

describe("issueRefsIn", () => {
  it("flags a reference in a line comment", () => {
    expect(issueRefsIn("const a = 1; // restores focus per #50\n")).toHaveLength(1);
  });

  it("flags a reference in a block comment, on the line it sits on", () => {
    const source = ["/**", " * A summary.", " *", " * Added for #134.", " */", "const a = 1;"].join(
      "\n"
    );
    const [found] = issueRefsIn(source);
    expect(found.ref).toBe("#134");
    expect(found.line).toBe(4);
  });

  it("does not flag a six-digit hex colour", () => {
    expect(issueRefsIn("// the chip is #3b9eff on a tinted field\n")).toEqual([]);
    expect(issueRefsIn("// all digits, still a colour: #123456\n")).toEqual([]);
  });

  it("does not flag a CSS id or a fragment", () => {
    expect(issueRefsIn("// focus moves to #task-title on open\n")).toEqual([]);
    expect(issueRefsIn("// see https://example.com/page#section\n")).toEqual([]);
  });

  it("flags a reference sharing a line with a colour", () => {
    // The regression this guard was written after: excluding a whole line for
    // containing a hex colour hides any reference beside it.
    const [found] = issueRefsIn("// lightened from #2f6fe0 to clear AA — #26\n");
    expect(found.ref).toBe("#26");
  });

  it("ignores anything outside a comment", () => {
    // A reference in a string is data, not a comment a reader has to decode.
    expect(issueRefsIn('const label = "resolves #50";\n')).toEqual([]);
  });

  it("does not treat a slash pair inside a string as starting a comment", () => {
    // Without this the rest of the line reads as a comment, and a `#nnn` in a
    // query string would be reported as prose.
    expect(issueRefsIn('const url = "https://example.com/?a=1#42";\n')).toEqual([]);
  });
});

describe("commentsIn", () => {
  it("counts lines past a multi-line comment", () => {
    const source = ["/*", " * two lines", " */", "const a = 1; // here"].join("\n");
    const found = commentsIn(source);
    expect(found).toHaveLength(2);
    expect(found[1].line).toBe(4);
  });

  it("counts lines past a multi-line template literal", () => {
    // A template spanning lines is skipped wholesale, so the line counter has
    // to advance through it or every comment after one is misreported.
    const source = ["const a = `one", "two", "three`;", "// here"].join("\n");
    const [found] = commentsIn(source);
    expect(found.line).toBe(4);
  });
});
