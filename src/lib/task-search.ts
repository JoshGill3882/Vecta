import type { TaskDTO } from "@/src/lib/dtos/tasks";

/**
 * A query reduced to the form every matcher compares against: trimmed
 * and lowercased. An empty result means "no query" - callers read that
 * as "match everything", never "match nothing".
 */
export function normaliseQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Title or description contains the needle. `needle` must already be normalised. */
export function matchesQuery(task: TaskDTO, needle: string): boolean {
  if (needle === "") return true;
  return (
    task.title.toLowerCase().includes(needle) || task.description.toLowerCase().includes(needle)
  );
}

/**
 * Everything the list narrows by, in one value. Grouping them is what keeps the
 * three call sites in `tasks-view.tsx` from each deciding for themselves whether
 * the list is currently narrowed - they ask here instead.
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

/** `categoryIds` empty is "no filter", matching how an empty needle reads. */
export function matchesCategory(task: TaskDTO, categoryIds: TaskNarrowing["categoryIds"]): boolean {
  if (categoryIds.size === 0) return true;
  return categoryIds.has(task.categoryId);
}

/**
 * Whether anything is narrowing the list. The rules that key off this - sections
 * forced open, empty sections dropped, the subtitle's "n of m" - apply to any
 * narrowing control, not to search specifically.
 */
export function isNarrowing({ needle, categoryIds }: TaskNarrowing): boolean {
  return needle !== "" || categoryIds.size > 0;
}

/** One pass producing the narrowed list, not one pass per criterion */
export function narrowTasks(tasks: TaskDTO[], narrowing: TaskNarrowing): TaskDTO[] {
  if (!isNarrowing(narrowing)) return tasks;
  return tasks.filter(
    (task) => matchesQuery(task, narrowing.needle) && matchesCategory(task, narrowing.categoryIds)
  );
}

/**
 * Every occurrence of `needle` in `text`, as [start, end]  index pairs into the
 * original string - so the called slices `text` itself and keeps its casting.
 *
 * indexOf over a lowercased copy rather than a RegExp: the query is user input,
 * so a regex would need every metacharacter escaped before it could be trusted -
 * a query of `.*` must highlight nothing, not everything. Not building a regex
 * skips that bug class rather than defending against it.
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
