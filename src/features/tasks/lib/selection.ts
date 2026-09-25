/** A copy of the selection with `id` flipped: added if absent, removed if present.
 *
 * Shared by the desktop category menu and the mobile filter sheet, so the two
 * controls cannot disagree about what a tap does.
 *
 * @param selection The current selection
 * @param id The option being toggled
 * @returns A new set. The input is never mutated, so React sees the change.
 */
export function toggled<T>(selection: ReadonlySet<T>, id: T): Set<T> {
  const next = new Set(selection);
  // delete reports whether it removed anything, so one call covers both ways.
  if (!next.delete(id)) next.add(id);
  return next;
}
