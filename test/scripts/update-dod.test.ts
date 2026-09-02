import { describe, it, expect } from "vitest";

// Pure functions — no API, no env. The module guards its own main() so importing
// it here never reaches for `gh`.
import {
  START,
  END,
  JOBS,
  renderBlock,
  replaceBlock,
  parseArgs,
  isSuperseded,
} from "../../scripts/update-dod.mjs";

// An issue body shaped like the templates: a CI-owned fence, with human
// judgement boxes on both sides of it.
const body = [
  "## Definition of Done",
  "",
  "### Verified by CI",
  "",
  START,
  "",
  "- [ ] Lint, typecheck and build pass",
  "- [ ] Test suite passes — no new regressions",
  "- [ ] Compose files validate",
  "",
  END,
  "",
  "### Requires human judgement",
  "",
  "- [x] All Acceptance Criteria met and verified",
  "- [x] Documentation updated (README, API docs, Confluence, etc.)",
  "- [ ] Code is appropriately commented — especially non-obvious logic",
].join("\n");

describe("renderBlock", () => {
  it("ticks only the jobs that succeeded", () => {
    const block = renderBlock({ checks: "success", test: "failure", compose: "success" }, null);
    expect(block).toContain("- [x] Lint, typecheck and build pass");
    expect(block).toContain("- [ ] Test suite passes — no new regressions");
    expect(block).toContain("- [x] Compose files validate");
  });

  it("leaves every box clear when given no results", () => {
    const block = renderBlock({}, null);
    for (const job of JOBS) {
      expect(block).toContain(`- [ ] ${job.label}`);
    }
    expect(block).not.toContain("- [x]");
  });

  // A cancelled or skipped job proves nothing, so it must read the same as a
  // failure rather than being treated as absent.
  it.each(["failure", "cancelled", "skipped", undefined])(
    "treats a %s result as unproven",
    (result) => {
      const block = renderBlock({ checks: result }, null);
      expect(block).toContain("- [ ] Lint, typecheck and build pass");
    }
  );

  it("records the commit it describes", () => {
    const block = renderBlock({}, "abc1234def5678");
    expect(block).toContain("`abc1234`");
  });

  it("is always wrapped in the markers so it can be replaced again", () => {
    const block = renderBlock({ checks: "success" }, "abc1234");
    expect(block.startsWith(START)).toBe(true);
    expect(block.endsWith(END)).toBe(true);
  });
});

describe("replaceBlock", () => {
  it("does not disturb human judgement boxes outside the fence", () => {
    const updated = replaceBlock(
      body,
      renderBlock({ checks: "success", test: "success", compose: "success" }, null)
    );
    expect(updated).toContain("- [x] All Acceptance Criteria met and verified");
    expect(updated).toContain("- [x] Documentation updated (README, API docs, Confluence, etc.)");
    expect(updated).toContain(
      "- [ ] Code is appropriately commented — especially non-obvious logic"
    );
    expect(updated).toContain("### Requires human judgement");
  });

  it("replaces the fenced content rather than appending to it", () => {
    const updated = replaceBlock(body, renderBlock({ checks: "success" }, null))!;
    expect(updated.match(new RegExp(START, "g"))).toHaveLength(1);
    expect(updated.match(new RegExp(END, "g"))).toHaveLength(1);
    expect(updated).toContain("- [x] Lint, typecheck and build pass");
  });

  // Round-tripping must converge: clearing after a full pass has to restore the
  // original, or repeated runs would drift.
  it("round-trips back to a cleared block", () => {
    const ticked = replaceBlock(
      body,
      renderBlock({ checks: "success", test: "success", compose: "success" }, null)
    )!;
    const cleared = replaceBlock(ticked, renderBlock({}, null));
    expect(cleared).toBe(replaceBlock(body, renderBlock({}, null)));
  });

  // An issue that documents the mechanism mentions the markers inline. A plain
  // substring search treated the first such mention as the fence and overwrote
  // the surrounding sentence, leaving the real block untouched.
  it("ignores markers mentioned inline in prose", () => {
    const documented = [
      "## Approach",
      "",
      "- a fenced section, delimited by `" + START + "` / `" + END + "`, holding",
      "  only claims a machine can verify",
      "",
      "## Definition of Done",
      "",
      START,
      "",
      "- [ ] Lint, typecheck and build pass",
      "",
      END,
    ].join("\n");

    const updated = replaceBlock(documented, renderBlock({ checks: "success" }, null))!;

    // The prose survives intact...
    expect(updated).toContain(
      "- a fenced section, delimited by `" + START + "` / `" + END + "`, holding"
    );
    expect(updated).toContain("only claims a machine can verify");
    // ...and the real block is the one that changed.
    expect(updated).toContain("- [x] Lint, typecheck and build pass");
  });

  it("ignores an indented marker that is not a fence of its own", () => {
    const nested = [
      "  " + START,
      "",
      "## Definition of Done",
      "",
      START,
      "",
      "- [ ] x",
      "",
      END,
    ].join("\n");
    const updated = replaceBlock(nested, renderBlock({}, null))!;
    expect(updated).toContain("  " + START);
  });

  it("returns null when the issue has no CI-owned section", () => {
    expect(replaceBlock("## Definition of Done\n\n- [ ] Something", "x")).toBeNull();
  });

  it("returns null when the markers are the wrong way round", () => {
    expect(replaceBlock(`${END}\nstray\n${START}`, "x")).toBeNull();
  });
});

describe("parseArgs", () => {
  it("reads --reset", () => {
    expect(parseArgs(["--reset"]).reset).toBe(true);
  });

  it("reads job results", () => {
    expect(parseArgs(["--results=checks:success,test:failure"]).results).toEqual({
      checks: "success",
      test: "failure",
    });
  });

  it("tolerates an empty result list", () => {
    expect(parseArgs(["--results="]).results).toEqual({});
  });

  it("defaults to no results and no reset", () => {
    const args = parseArgs([]);
    expect(args.results).toEqual({});
    expect(args.reset).toBe(false);
  });
});

describe("isSuperseded", () => {
  it("allows a write when the run is still the head", () => {
    expect(isSuperseded("abc123", "abc123")).toBe(false);
  });

  it("blocks a write once the head has moved on", () => {
    expect(isSuperseded("abc123", "def456")).toBe(true);
  });

  // Blocking on missing information would make every run a no-op, which fails
  // silently and is worse than the race it guards against.
  it("does not block when either sha is unavailable", () => {
    expect(isSuperseded(undefined, "def456")).toBe(false);
    expect(isSuperseded("abc123", undefined)).toBe(false);
    expect(isSuperseded("", "")).toBe(false);
  });
});
