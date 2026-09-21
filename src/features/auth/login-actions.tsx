"use server"; // ← THIS is what turns every export below into a Server Action

import { isRateLimited, recordFailure } from "@/src/features/auth/lib/rate-limit";
import { createHash, timingSafeEqual } from "node:crypto";
import { createSession } from "@/src/shared/lib/session";
import { redirect } from "next/navigation";

/** What the sign-in form renders after an attempt. */
export interface LoginState {
  /** A message covering the whole form, when one applies. */
  error?: string;
}

/** Compares a submitted password against the configured one.
 *
 * Hashing both first gives equal-length digests, so the comparison never
 * throws on a length mismatch and the password's length is not leaked by how
 * long the comparison takes.
 *
 * @param input The submitted password.
 * @param expected The configured password.
 * @returns Whether they match.
 */
function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Reduces a requested destination to one that is safe to redirect to.
 *
 * Only same-origin absolute paths are honoured. A protocol-relative
 * (`//host`) or backslash (`/\host`) value is one some browsers read as a
 * host, which would turn the post-login redirect into an open redirect.
 *
 * @param raw The requested destination, from the query string.
 * @returns The destination, or the root when it cannot be trusted.
 */
function safeRedirectTarget(raw: string | undefined): string {
  const next = raw ?? "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

/** Server Action for signing in.
 *
 * @param prevState The previous form state, which this replaces.
 * @param formData The submitted credentials.
 * @returns The new form state: an error to render, or a redirect that throws.
 */
export async function loginAction(prevState: LoginState, formData: FormData): Promise<LoginState> {
  if (isRateLimited()) return { error: "Too many attempts. Retry in a minute" };

  // Extract password from form data
  const password = formData.get("password")?.toString() ?? "";

  // If the passwords don't match, return an error
  if (!passwordMatches(password, process.env.ADMIN_PASSWORD!)) {
    recordFailure();
    return { error: "Password Invalid" };
  }

  await createSession();
  redirect(safeRedirectTarget(formData.get("next")?.toString()));
}
