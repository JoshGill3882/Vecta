import type { LogEntryDTO } from "@/src/shared/lib/dtos/logs";

/** One value from an entry's detail, as the Logs page lists it. */
export interface DetailField {
  /** Where the value sits in the detail, such as `title` or `error.code`. */
  name: string;
  /** The value as text. */
  value: string;
}

/** An entry's detail, laid out for the Logs page. */
export interface DetailLayout {
  /** Every value but the stacks, in the order the detail holds them. */
  fields: DetailField[];
  /** Every error stack, each shown in a block of its own. */
  stacks: DetailField[];
}

/** Whether a value is an object with fields, rather than a list or null.
 *
 * @param value Any value parsed from JSON.
 * @returns True for a plain object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Writes one value as text.
 *
 * Text is shown as it was recorded, without the quotes JSON would add. A list
 * is shown as its items, so `changed` reads `title, status`.
 *
 * @param value Any value parsed from JSON, other than an object with fields.
 * @returns The value as text.
 */
function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(", ");
  }
  return JSON.stringify(value);
}

/** Adds one value to the layout, opening an object into a field per value.
 *
 * @param layout The layout being built.
 * @param name Where the value sits, such as `error.cause.code`.
 * @param key The last part of that name, which says whether it is a stack.
 * @param value The value.
 */
function addValue(layout: DetailLayout, name: string, key: string, value: unknown): void {
  if (isRecord(value) && Object.keys(value).length > 0) {
    for (const [innerKey, inner] of Object.entries(value)) {
      addValue(layout, `${name}.${innerKey}`, innerKey, inner);
    }
    return;
  }
  const isStack = key === "stack" && typeof value === "string";
  (isStack ? layout.stacks : layout.fields).push({ name, value: asText(value) });
}

/** Lays out an entry's detail for its row on the Logs page.
 *
 * An object inside the detail, such as a recorded error, is opened into a
 * field per value, named by where it sits, so `error.message` and
 * `error.code` each get a line. A stack is many lines long, so each one is
 * kept apart to be shown in a block of its own.
 *
 * @param detail The entry's detail, or null when it has none.
 * @returns Its fields and its stacks, each empty when there are none.
 */
export function detailLayout(detail: LogEntryDTO["detail"]): DetailLayout {
  const layout: DetailLayout = { fields: [], stacks: [] };
  for (const [key, value] of Object.entries(detail ?? {})) addValue(layout, key, key, value);
  return layout;
}
