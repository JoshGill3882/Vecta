import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";

/** Reduces a query to the form every matcher compares against.
 *
 * @param query The query as typed.
 * @returns The query trimmed and lowercased. Empty means "no query", which
 *   callers read as "match everything" and never as "match nothing".
 */
export function normaliseQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Title or description contains the needle.
 *
 * @param task Task to test.
 * @param needle Must already be normalised by `normaliseQuery`.
 * @returns Whether either field contains it.
 */
export function matchesQuery(task: TaskDTO, needle: string): boolean {
  if (needle === "") return true;
  return (
    task.title.toLowerCase().includes(needle) || task.description.toLowerCase().includes(needle)
  );
}

/** Everything the list narrows by, in one value.
 *
 * Grouping them is what stops each rule that depends on narrowing deciding for
 * itself whether the list is narrowed; they ask this module instead.
 */
export type TaskNarrowing = {
  /** Already normalised. Empty means "no query", never "match nothing". */
  needle: string;
  /**
   * Selected category ids, where `null` is the Uncategorised option rather than
   * a sentinel string: `TaskDTO.categoryId` is `string | null`, so a set holding
   * `null` matches an uncategorised task directly and no call site has to
   * translate. Empty means "no category filter" - the same "match everything"
   * reading `needle` gets.
   */
  categoryIds: ReadonlySet<string | null>;
};

/** The task is in one of the selected categories.
 *
 * @param task Task to test.
 * @param categoryIds Selected ids. Empty is "no filter", matching how an empty
 *   needle reads.
 * @returns Whether the task passes the category filter.
 */
export function matchesCategory(task: TaskDTO, categoryIds: TaskNarrowing["categoryIds"]): boolean {
  if (categoryIds.size === 0) return true;
  return categoryIds.has(task.categoryId);
}

/** Whether anything is narrowing the list.
 *
 * The rules keying off this — sections forced open, empty sections dropped, the
 * subtitle switching to "n of m" — belong to narrowing in general rather than
 * to search, so none of them tests a query directly.
 *
 * @returns True when a query or a category selection is in force.
 */
export function isNarrowing({ needle, categoryIds }: TaskNarrowing): boolean {
  return needle !== "" || categoryIds.size > 0;
}

/** Applies every criterion in one pass, rather than one pass per criterion.
 *
 * @param tasks The full list.
 * @param narrowing The criteria to apply.
 * @returns The tasks satisfying all of them, or the input itself when nothing
 *   narrows — so the common case costs no copy.
 */
export function narrowTasks(tasks: TaskDTO[], narrowing: TaskNarrowing): TaskDTO[] {
  if (!isNarrowing(narrowing)) return tasks;
  return tasks.filter(
    (task) => matchesQuery(task, narrowing.needle) && matchesCategory(task, narrowing.categoryIds)
  );
}

/** Locates every occurrence of the needle, for highlighting.
 *
 * Uses `indexOf` over a lowercased copy rather than a RegExp: the query is user
 * input, so a pattern built from it would need every metacharacter escaped
 * before it could be trusted — a query of `.*` must highlight those two
 * characters, not the whole string. Not building a regex skips that class of
 * bug rather than defending against it.
 *
 * @param text The string to search, returned unchanged.
 * @param needle Must already be normalised by `normaliseQuery`.
 * @returns Start and end index pairs into `text`, so the caller slices the
 *   original and keeps its casing. Empty when a lowercased copy would not line
 *   up index-for-index with the original, since a mis-sliced title is worse
 *   than no highlight.
 */
export function findMatches(text: string, needle: string): [number, number][] {
  if (needle === "") return [];

  const haystack = text.toLowerCase();
  // A few characters lowercase to a different number of code units, which slides
  // every index out of step with `text`. Rare enough to decline rather than
  // handle: no highlight beats a mis-sliced title
  if (haystack.length !== text.length) return [];

  const ranges: [number, number][] = [];
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    ranges.push([at, at + needle.length]);
    at = haystack.indexOf(needle, at + needle.length);
  }
  return ranges;
}
