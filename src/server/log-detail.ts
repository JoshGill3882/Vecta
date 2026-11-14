// Prepares a log entry's detail for its two destinations, stdout and the Log
// table. Both serialise it as JSON, so whatever is returned here must survive
// that and must not carry a secret into a log that may be exported or shared.

/** What a sensitive value is replaced with. */
export const REDACTED = "[redacted]";

/** What stands in for an object that contains itself. */
export const CIRCULAR = "[circular]";

/** Keys whose values are never logged, compared after `normaliseKey`.
 *
 * Kept short and explicit: a key is added because the app holds a value under
 * that name, not on the chance that something might. Any key ending in
 * `password` is caught separately, so `password`, `adminPassword` and
 * `ADMIN_PASSWORD` are all covered.
 */
const SENSITIVE_KEYS = new Set(["sessionsecret", "session", "cookie", "cookies", "setcookie"]);

/** The user and password part of a URL, such as `vecta:secret@` in a Postgres URL.
 *
 * Matches a scheme followed by `//`, then everything up to an `@` that comes
 * before the first `/`, `?`, `#` or whitespace, so a later `@` in a path is left
 * alone.
 */
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/?#@]+@/gi;

/** Reduces a key to the form `SENSITIVE_KEYS` holds.
 *
 * @param key The key as the caller wrote it.
 * @returns It in lower case, with `_` and `-` removed.
 */
function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

/** Whether a key's value must be hidden.
 *
 * @param key The key as the caller wrote it.
 * @returns True for any key ending in `password`, and for the keys in `SENSITIVE_KEYS`.
 */
function isSensitiveKey(key: string): boolean {
  const normalised = normaliseKey(key);
  return normalised.endsWith("password") || SENSITIVE_KEYS.has(normalised);
}

/** Removes the credentials from every URL in a piece of text.
 *
 * @param text Any text, such as a message or an error's stack.
 * @returns The same text, with each URL's `user:password@` replaced by `[redacted]@`.
 */
export function scrubUrlCredentials(text: string): string {
  return text.replace(URL_CREDENTIALS, `$1${REDACTED}@`);
}

/** Prepares an object's own enumerable fields, hiding sensitive ones.
 *
 * @param record The object to copy.
 * @param ancestors The objects being prepared above this one, to catch a loop.
 * @returns A plain copy that is safe to serialise.
 */
function prepareRecord(record: object, ancestors: Set<object>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      isSensitiveKey(key) ? REDACTED : prepareValue(value, ancestors),
    ])
  );
}

/** Turns an error into plain fields JSON can hold.
 *
 * Needed because JSON serialises an `Error` as `{}`: its name, message and stack
 * are not its own enumerable fields. Fields an error does carry as its own,
 * such as a Prisma error's `code`, are kept too.
 *
 * @param error The error to describe.
 * @param ancestors The objects being prepared above this one, to catch a loop.
 * @returns Its own fields, then its name, message, stack and cause.
 */
function prepareError(error: Error, ancestors: Set<object>): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    ...prepareRecord(error, ancestors),
    name: error.name,
    message: scrubUrlCredentials(error.message),
    stack: error.stack === undefined ? undefined : scrubUrlCredentials(error.stack),
  };
  if (error.cause !== undefined) {
    fields.cause = prepareValue(error.cause, ancestors);
  }
  return fields;
}

/** Prepares any value found in a detail object.
 *
 * Only an object's ancestors count as a loop. The same object appearing twice
 * side by side is copied twice, not marked circular.
 *
 * @param value The value to prepare.
 * @param ancestors The objects being prepared above this one, to catch a loop.
 * @returns A copy that is safe to serialise, with secrets hidden.
 */
function prepareValue(value: unknown, ancestors: Set<object>): unknown {
  if (typeof value === "string") return scrubUrlCredentials(value);
  // JSON cannot hold a BigInt and throws on one, so it is written as its digits.
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object" || value === null) return value;
  // A Date serialises itself, as its ISO string.
  if (value instanceof Date) return value;
  if (ancestors.has(value)) return CIRCULAR;

  ancestors.add(value);
  try {
    if (value instanceof Error) return prepareError(value, ancestors);
    if (Array.isArray(value)) return value.map((item) => prepareValue(item, ancestors));
    return prepareRecord(value, ancestors);
  } finally {
    ancestors.delete(value);
  }
}

/** Prepares a log entry's detail for stdout and the Log table.
 *
 * Returns a copy and leaves the caller's object untouched.
 *
 * @param detail The context the caller recorded.
 * @returns A plain copy that is safe to serialise, with sensitive keys hidden,
 *   credentials removed from URLs, errors spelled out, and loops broken.
 */
export function prepareDetail(detail: Record<string, unknown>): Record<string, unknown> {
  return prepareRecord(detail, new Set([detail]));
}
