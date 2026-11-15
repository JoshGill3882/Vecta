/** The names of the fields an update actually changes.
 *
 * A field counts when the update supplies it and its new value differs from
 * the stored one. An omitted field is left as it was, so it never counts.
 * Values are compared with `===`, which suits columns holding strings, numbers
 * and null; a Date or other object would always count as changed.
 *
 * @param before The row as it was stored.
 * @param update The validated fields being written.
 * @returns The changed field names, in the order the update lists them.
 */
export function changedFields(
  before: Record<string, unknown>,
  update: Record<string, unknown>
): string[] {
  return Object.keys(update).filter(
    (key) => update[key] !== undefined && update[key] !== before[key]
  );
}
