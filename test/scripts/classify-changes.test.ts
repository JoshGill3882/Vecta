import { describe, it, expect } from "vitest";

import { isDocsOnly, isDocumentation } from "@/scripts/classify-changes.mjs";

describe("isDocumentation", () => {
  it.each([
    "README.md",
    "CHANGELOG.md",
    "docs/guides/ui.md",
    ".github/ISSUE_TEMPLATE/release.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
    "docs/images/task-list.png",
  ])("counts %s as documentation", (path) => {
    expect(isDocumentation(path)).toBe(true);
  });

  // Each of these can change what CI proves, so none may be mistaken for prose.
  it.each([
    "src/features/tasks/lib/due-date.ts",
    "package.json",
    "package-lock.json",
    ".github/workflows/ci.yml",
    "scripts/classify-changes.mjs",
    ".markdownlint.jsonc",
    "docker-compose.yml",
    ".env.example",
    "public/logo.png",
    // Only a trailing `.md` counts, not one anywhere in the name.
    "src/readme.md.ts",
    "docs/images.ts",
  ])("does not count %s as documentation", (path) => {
    expect(isDocumentation(path)).toBe(false);
  });
});

describe("isDocsOnly", () => {
  it("is true when every changed path is documentation", () => {
    expect(isDocsOnly(["README.md", "docs/guides/ui.md", "docs/images/task-list.png"])).toBe(true);
  });

  it("is false when any one path is not", () => {
    expect(isDocsOnly(["README.md", "CHANGELOG.md", "package.json"])).toBe(false);
  });

  // An unreadable diff arrives as nothing at all. Treating that as "only
  // documentation" would skip every check on a change nobody looked at.
  it.each([[[]], [[""]], [["", "  ", "\n"]]])("is false for an empty list %j", (paths) => {
    expect(isDocsOnly(paths)).toBe(false);
  });

  it("ignores blank lines and surrounding whitespace in the list", () => {
    expect(isDocsOnly(["README.md", "", "  CHANGELOG.md  ", ""])).toBe(true);
  });

  // A file renamed from code to Markdown is listed under both names, since the
  // diff is taken without rename detection; the old name keeps it a code change.
  it("is false for a code file renamed to Markdown", () => {
    expect(isDocsOnly(["src/notes.ts", "src/notes.md"])).toBe(false);
  });
});
