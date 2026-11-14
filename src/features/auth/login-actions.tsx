"use server"; // ← THIS is what turns every export below into a Server Action

import { signIn } from "@/src/server/services/auth";
import { redirect } from "next/navigation";

/** What the sign-in form renders after an attempt. */
export interface LoginState {
  /** A message covering the whole form, when one applies. */
  error?: string;
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
  // Extract password from form data
  const password = formData.get("password")?.toString() ?? "";

  const result = await signIn(password);
  if (result === "rate_limited") return { error: "Too many attempts. Retry in a minute" };
  if (result === "wrong_password") return { error: "Password Invalid" };

  redirect(safeRedirectTarget(formData.get("next")?.toString()));
}
