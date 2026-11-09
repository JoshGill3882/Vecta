import { describe, it, expect } from "vitest";
import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";
import type { DueBucket } from "@/src/features/tasks/lib/due-date";
import {
  normaliseQuery,
  matchesQuery,
  matchesCategory,
  matchesDue,
  isNarrowing,
  narrowTasks,
  findMatches,
} from "@/src/features/tasks/lib/task-search";

// Sunday 27 September 2026, 10:00 local. The due-date options are measured from
// here, so the cases mean the same thing whatever day they run on.
const NOW = new Date(2026, 8, 27, 10, 0);

const noCategories: ReadonlySet<string | null> = new Set();
const noDue: ReadonlySet<DueBucket> = new Set();

// Only the fields the search reads carry meaning here; the rest are filler so
// the fixtures are real TaskDTOs rather than partials cast into place.
/** Builds a task fixture.
 *
 * @param overrides Fields that matter to the case; the id is required so two
 *   fixtures can be told apart in an assertion.
 * @returns A complete task, filler included, so the fixture is a real DTO
 *   rather than a partial cast into place.
 */
function task(overrides: Partial<TaskDTO> & Pick<TaskDTO, "id">): TaskDTO {
  return {
    title: "",
    description: "",
    status: "open",
    categoryId: null,
    dueAt: null,
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

describe("matchesCategory", () => {
  const filed = task({ id: "a", categoryId: "home" });
  const loose = task({ id: "b", categoryId: null });

  it("matches everything when nothing is selected", () => {
    // Empty reads as "no filter", exactly as an empty needle does. A filter that
    // selected nothing would be a control whose default state hides the list.
    expect(matchesCategory(filed, new Set())).toBe(true);
    expect(matchesCategory(loose, new Set())).toBe(true);
  });

  it("keeps a task in a selected category and drops one that is not", () => {
    const selected = new Set<string | null>(["home"]);
    expect(matchesCategory(filed, selected)).toBe(true);
    expect(matchesCategory(task({ id: "c", categoryId: "work" }), selected)).toBe(false);
  });

  it("reaches uncategorised tasks through null", () => {
    // The Uncategorised option is literally `null` in the set rather than a
    // sentinel string, so this needs no special case at the call site.
    expect(matchesCategory(loose, new Set<string | null>([null]))).toBe(true);
  });

  it("does not let a selected category match an uncategorised task", () => {
    expect(matchesCategory(loose, new Set<string | null>(["home"]))).toBe(false);
  });

  it("matches either when a category and null are both selected", () => {
    const both = new Set<string | null>(["home", null]);
    expect(matchesCategory(filed, both)).toBe(true);
    expect(matchesCategory(loose, both)).toBe(true);
  });
});

describe("matchesDue", () => {
  const late = task({ id: "late", dueAt: "2026-09-22" });
  const undated = task({ id: "undated" });
  const nextMonth = task({ id: "next-month", dueAt: "2026-10-27" });

  it("matches everything when nothing is selected", () => {
    // The same "no filter" reading as the other two: a task due next month,
    // which no option reaches, is never unreachable while the filter is off.
    for (const subject of [late, undated, nextMonth]) {
      expect(matchesDue(subject, noDue, NOW)).toBe(true);
    }
  });

  it("matches a task in any selected option, not only in all of them", () => {
    // Overdue and No due date share no task, so an intersection would be empty.
    const either = new Set<DueBucket>(["overdue", "none"]);
    expect(matchesDue(late, either, NOW)).toBe(true);
    expect(matchesDue(undated, either, NOW)).toBe(true);
    expect(matchesDue(nextMonth, either, NOW)).toBe(false);
  });

  it("drops a task that is in none of the selected options", () => {
    expect(matchesDue(nextMonth, new Set<DueBucket>(["week"]), NOW)).toBe(false);
  });
});

describe("isNarrowing", () => {
  it("is false with no query, no categories and no due-date option", () => {
    expect(isNarrowing({ needle: "", categoryIds: noCategories, dueBuckets: noDue })).toBe(false);
  });

  it("is true with a query alone", () => {
    expect(isNarrowing({ needle: "milk", categoryIds: noCategories, dueBuckets: noDue })).toBe(
      true
    );
  });

  it("is true with a category alone", () => {
    // The rule this drives is what stops a filtered-away section rendering an
    // empty shell, so a filter with no query has to register as narrowing.
    expect(
      isNarrowing({ needle: "", categoryIds: new Set<string | null>(["home"]), dueBuckets: noDue })
    ).toBe(true);
  });

  it("is true when Uncategorised alone is selected", () => {
    // `null` is a selection like any other - a set holding only it is not empty.
    expect(
      isNarrowing({ needle: "", categoryIds: new Set<string | null>([null]), dueBuckets: noDue })
    ).toBe(true);
  });

  it("is true with a due-date option alone", () => {
    // So the sections open, empty ones drop and the header says "n of m" with
    // only the due-date filter in force, exactly as for the other two.
    expect(
      isNarrowing({
        needle: "",
        categoryIds: noCategories,
        dueBuckets: new Set<DueBucket>(["overdue"]),
      })
    ).toBe(true);
  });

  it("is true with both a query and a category", () => {
    expect(
      isNarrowing({
        needle: "milk",
        categoryIds: new Set<string | null>(["home"]),
        dueBuckets: noDue,
      })
    ).toBe(true);
  });
});

describe("narrowTasks", () => {
  const tasks = [
    task({ id: "a", title: "Renew the TLS certificate", categoryId: "infra", dueAt: "2026-09-22" }),
    task({ id: "b", title: "Book flights", description: "Certificate of travel needed" }),
    task({ id: "c", title: "Buy milk", categoryId: "home", dueAt: "2026-09-27" }),
  ];

  it("keeps only the tasks that match, in their original order", () => {
    expect(
      narrowTasks(
        tasks,
        { needle: "certificate", categoryIds: noCategories, dueBuckets: noDue },
        NOW
      ).map((t) => t.id)
    ).toEqual(["a", "b"]);
  });

  it("returns the input untouched when nothing is narrowing", () => {
    // Identity, not just equality: the no-narrowing path must not pay for a copy
    // on every keystroke that clears the field.
    expect(
      narrowTasks(tasks, { needle: "", categoryIds: noCategories, dueBuckets: noDue }, NOW)
    ).toBe(tasks);
  });

  it("returns nothing when nothing matches", () => {
    expect(
      narrowTasks(tasks, { needle: "zzz", categoryIds: noCategories, dueBuckets: noDue }, NOW)
    ).toEqual([]);
  });

  it("narrows by category alone", () => {
    const byCategory = narrowTasks(
      tasks,
      { needle: "", categoryIds: new Set<string | null>(["home"]), dueBuckets: noDue },
      NOW
    );
    expect(byCategory.map((t) => t.id)).toEqual(["c"]);
  });

  it("narrows by due-date option alone", () => {
    const dueToday = narrowTasks(
      tasks,
      { needle: "", categoryIds: noCategories, dueBuckets: new Set<DueBucket>(["today"]) },
      NOW
    );
    expect(dueToday.map((t) => t.id)).toEqual(["c"]);
  });

  it("requires both criteria when both are active", () => {
    // Composition is an AND, not an OR: "certificate" matches a and b, "infra"
    // matches only a, so only a survives both.
    const both = narrowTasks(
      tasks,
      { needle: "certificate", categoryIds: new Set<string | null>(["infra"]), dueBuckets: noDue },
      NOW
    );
    expect(both.map((t) => t.id)).toEqual(["a"]);
  });

  it("requires all three criteria when all three are active", () => {
    // "certificate" matches a and b, "infra" only a, and Overdue only a; adding
    // No due date to the due options reaches b, which the category still drops.
    const all = narrowTasks(
      tasks,
      {
        needle: "certificate",
        categoryIds: new Set<string | null>(["infra"]),
        dueBuckets: new Set<DueBucket>(["overdue", "none"]),
      },
      NOW
    );
    expect(all.map((t) => t.id)).toEqual(["a"]);
  });

  it("can return nothing when each criterion matches but no task matches both", () => {
    const both = narrowTasks(
      tasks,
      { needle: "milk", categoryIds: new Set<string | null>(["infra"]), dueBuckets: noDue },
      NOW
    );
    expect(both).toEqual([]);
  });

  it("reaches uncategorised tasks", () => {
    const loose = narrowTasks(
      tasks,
      { needle: "", categoryIds: new Set<string | null>([null]), dueBuckets: noDue },
      NOW
    );
    expect(loose.map((t) => t.id)).toEqual(["b"]);
  });

  it("leaves the input array untouched", () => {
    narrowTasks(tasks, { needle: "milk", categoryIds: noCategories, dueBuckets: noDue }, NOW);
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
