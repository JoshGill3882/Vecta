import { describe, it, expect } from "vitest";
import type { TaskDTO } from "../../src/lib/dtos/tasks";
import { normaliseQuery, matchesQuery, filterTasks, findMatches } from "../../src/lib/task-search";

// Only the fields the search reads carry meaning here; the rest are filler so
// the fixtures are real TaskDTOs rather than partials cast into place.
function task(overrides: Partial<TaskDTO> & Pick<TaskDTO, "id">): TaskDTO {
  return {
    title: "",
    description: "",
    status: "open",
    categoryId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normaliseQuery", () => {
  it("trims and lowercases", () => {
    expect(normaliseQuery("  Deploy The Thing  ")).toBe("deploy the thing");
  });

  it("reduces a whitespace-only query to the empty string", () => {
    // The empty string is the signal every caller reads as "no query", so a
    // query of spaces must not be mistaken for one that matches nothing.
    expect(normaliseQuery("   \t\n ")).toBe("");
  });
});

describe("matchesQuery", () => {
  const subject = task({
    id: "t1",
    title: "Renew the TLS certificate",
    description: "Expires in March. Use certbot.",
  });

  it("matches on the title, case-insensitively", () => {
    expect(matchesQuery(subject, "tls")).toBe(true);
  });

  it("matches on the description as well as the title", () => {
    expect(matchesQuery(subject, "certbot")).toBe(true);
  });

  it("matches a substring mid-word, not just a whole word", () => {
    expect(matchesQuery(subject, "ertific")).toBe(true);
  });

  it("does not match text that appears in neither field", () => {
    expect(matchesQuery(subject, "invoice")).toBe(false);
  });

  it("matches everything when the needle is empty", () => {
    expect(matchesQuery(subject, "")).toBe(true);
  });

  it("handles a task with no description", () => {
    const bare = task({ id: "t2", title: "Buy milk" });
    expect(matchesQuery(bare, "milk")).toBe(true);
    expect(matchesQuery(bare, "certbot")).toBe(false);
  });
});

describe("filterTasks", () => {
  const tasks = [
    task({ id: "a", title: "Renew the TLS certificate" }),
    task({ id: "b", title: "Book flights", description: "Certificate of travel needed" }),
    task({ id: "c", title: "Buy milk" }),
  ];

  it("keeps only the tasks that match, in their original order", () => {
    expect(filterTasks(tasks, "certificate").map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("returns everything when the needle is empty", () => {
    expect(filterTasks(tasks, "")).toHaveLength(3);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterTasks(tasks, "zzz")).toEqual([]);
  });

  it("leaves the input array untouched", () => {
    filterTasks(tasks, "milk");
    expect(tasks.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});

describe("findMatches", () => {
  it("returns an index pair per occurrence", () => {
    expect(findMatches("banana", "an")).toEqual([
      [1, 3],
      [3, 5],
    ]);
  });

  it("indexes into the original string, so the caller keeps its casing", () => {
    const text = "Renew the TLS certificate";
    const [[start, end]] = findMatches(text, "tls");
    expect(text.slice(start, end)).toBe("TLS");
  });

  it("does not overlap matches", () => {
    // "aa" appears at 0, 1 and 2 if overlaps count. The caller slices these
    // ranges in sequence, so overlapping pairs would duplicate characters.
    expect(findMatches("aaaa", "aa")).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });

  it("returns nothing for an empty needle", () => {
    expect(findMatches("anything", "")).toEqual([]);
  });

  it("treats regex metacharacters as literal text", () => {
    // The whole reason this is indexOf and not a RegExp: `.*` must find the two
    // characters, not every character.
    expect(findMatches("Renew the certificate", ".*")).toEqual([]);
    expect(findMatches("Wildcard .* in a title", ".*")).toEqual([[9, 11]]);
  });

  it("finds a literal open bracket, which would be an invalid pattern", () => {
    // An unclosed `[` throws when compiled as a regex; here it is just a
    // character, and a query mid-typing routinely contains one.
    expect(findMatches("Fix the [urgent] bug", "[urgent")).toEqual([[8, 15]]);
  });

  it("declines rather than mis-slices when lowercasing changes the length", () => {
    // "İ" (U+0130) lowercases to two code units in JS, which would slide every
    // index after it out of step with the original string. No highlight is the
    // intended outcome, not a highlight in the wrong place.
    const text = "İstanbul office move";
    expect(text.toLowerCase().length).not.toBe(text.length);
    expect(findMatches(text, "office")).toEqual([]);
  });
});
