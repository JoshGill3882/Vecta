import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { logger } from "@/src/server/logger";
import { isRateLimited, recordFailure } from "@/src/server/rate-limit";
import { createSession, destroySession } from "@/src/shared/lib/session";

// Auth service — signing in and out, and recording each attempt as activity.
// An entry records that an attempt happened and how it ended, never what was
// typed: not the password, its length, or anything derived from it.

/** How a sign-in attempt ended. */
export type SignInResult = "signed_in" | "wrong_password" | "rate_limited";

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

/** Signs in with the admin password, unless too many attempts have failed.
 *
 * A refused attempt is recorded as well as a wrong password: a burst of them
 * is the clearest sign that someone is guessing.
 *
 * @param password The submitted password.
 * @returns How the attempt ended. On `signed_in`, the session cookie is set.
 */
export async function signIn(password: string): Promise<SignInResult> {
  if (isRateLimited()) {
    logger.activity.warn("auth.sign_in_failed", "Sign-in failed", { reason: "rate_limited" });
    return "rate_limited";
  }

  if (!passwordMatches(password, process.env.ADMIN_PASSWORD!)) {
    recordFailure();
    logger.activity.warn("auth.sign_in_failed", "Sign-in failed", { reason: "wrong_password" });
    return "wrong_password";
  }

  await createSession();
  logger.activity.info("auth.signed_in", "Signed in");
  return "signed_in";
}

/** Signs out, clearing the session and expiring its cookie. */
export async function signOut(): Promise<void> {
  await destroySession();
  logger.activity.info("auth.signed_out", "Signed out");
}
