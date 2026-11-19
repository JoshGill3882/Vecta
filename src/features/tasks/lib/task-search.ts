import type { TaskDTO } from "@/src/shared/lib/dtos/tasks";

import { inDueBucket, type DueBucket } from "@/src/features/tasks/lib/due-date";

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
  /** Selected category ids, where `null` is the Uncategorised option.
   *
   * `null` rather than a sentinel string: `TaskDTO.categoryId` is
   * `string | null`, so a set holding `null` matches an uncategorised task
   * directly and no call site has to translate.
   *
   * Empty means "no category filter" - the same "match everything" reading
   * `needle` gets.
   */
  categoryIds: ReadonlySet<string | null>;
  /** Selected due-date options. Empty means "no due filter", read the same
   * way as an empty `needle`. */
  dueBuckets: ReadonlySet<DueBucket>;
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

/** The task is in any of the selected due-date options.
 *
 * Any rather than all: the options overlap and leave gaps, so "Overdue" with
 * "No due date" has to show both sets, not the empty set the two share.
 *
 * @param task Task to test.
 * @param dueBuckets Selected options. Empty is "no filter".
 * @param now The moment "today" is measured from, taken once by the caller.
 * @returns Whether the task passes the due-date filter.
 */
export function matchesDue(
  task: TaskDTO,
  dueBuckets: TaskNarrowing["dueBuckets"],
  now: Date
): boolean {
  if (dueBuckets.size === 0) return true;
  return [...dueBuckets].some((bucket) => inDueBucket(task, bucket, now));
}

/** Whether anything is narrowing the list.
 *
 * The rules keying off this — sections forced open, empty sections dropped, the
 * subtitle switching to "n of m" — belong to narrowing in general rather than
 * to search, so none of them tests a query directly.
 *
 * @returns True when a query, a category or a due-date option is in force.
 */
export function isNarrowing({ needle, categoryIds, dueBuckets }: TaskNarrowing): boolean {
  return needle !== "" || categoryIds.size > 0 || dueBuckets.size > 0;
}

/** Applies every criterion in one pass, rather than one pass per criterion.
 *
 * @param tasks The full list.
 * @param narrowing The criteria to apply.
 * @param now The moment the due-date options are measured from. Pass the one
 *   the cards are drawn against, so a card and the filter agree on what is late.
 * @returns The tasks satisfying all of them, or the input itself when nothing
 *   narrows — so the common case costs no copy.
 */
export function narrowTasks(tasks: TaskDTO[], narrowing: TaskNarrowing, now: Date): TaskDTO[] {
  if (!isNarrowing(narrowing)) return tasks;
  return tasks.filter(
    (task) =>
      matchesQuery(task, narrowing.needle) &&
      matchesCategory(task, narrowing.categoryIds) &&
      matchesDue(task, narrowing.dueBuckets, now)
  );
}
