/** Reduces a query to the form every matcher compares against.
 *
 * @param query The query as typed.
 * @returns The query trimmed and lowercased. Empty means "no query", which
 *   callers read as "match everything" and never as "match nothing".
 */
export function normaliseQuery(query: string): string {
  return query.trim().toLowerCase();
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
 *   up index-for-index with the original, since a mis-sliced string is worse
 *   than no highlight.
 */
export function findMatches(text: string, needle: string): [number, number][] {
  if (needle === "") return [];

  const haystack = text.toLowerCase();
  // A few characters lowercase to a different number of code units, which slides
  // every index out of step with `text`. Rare enough to decline rather than
  // handle: no highlight beats a mis-sliced string
  if (haystack.length !== text.length) return [];

  const ranges: [number, number][] = [];
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    ranges.push([at, at + needle.length]);
    at = haystack.indexOf(needle, at + needle.length);
  }
  return ranges;
}
