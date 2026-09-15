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

export function filterTasks(tasks: TaskDTO[], needle: string): TaskDTO[] {
  return needle === "" ? tasks : tasks.filter((task) => matchesQuery(task, needle));
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
