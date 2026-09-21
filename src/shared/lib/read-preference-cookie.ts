import "server-only";
import { cookies } from "next/headers";

/** Reads a preference cookie during a server render.
 *
 * The client writes these, so the value is untrusted twice over: it survives
 * deploys and is editable by hand. Anything the parser rejects falls back,
 * and so does anything that is not valid JSON - a cookie can be set by anyone
 * with the console open.
 *
 * @param name The cookie name.
 * @param parse Validates the parsed value, as the browser does.
 * @param fallback Used when the cookie is absent or unusable.
 * @returns The stored preference, or the fallback.
 */
export async function readPreferenceCookie<T>(
  name: string,
  parse: (raw: unknown) => T | undefined,
  fallback: T
): Promise<T> {
  const raw = (await cookies()).get(name)?.value;
  if (raw === undefined) return fallback;

  try {
    return parse(JSON.parse(decodeURIComponent(raw))) ?? fallback;
  } catch {
    return fallback;
  }
}
