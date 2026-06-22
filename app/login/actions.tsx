"use server"; // ← THIS is what turns every export below into a Server Action

import { isRateLimited, recordFailure } from "@/src/lib/rate-limit";
import { createHash, timingSafeEqual } from "node:crypto";
import { createSession } from "@/src/lib/session";
import { redirect } from "next/navigation";

export interface LoginState {
  error?: string;
}

// Equal-length digests → timingSafeEqual never throws, and the password
// length isn't leaked by the comparison.
function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// Only honour same-origin, absolute-path destinations. Reject protocol-relative
// ("//host") and backslash ("/\host") values that browsers may treat as a host —
// otherwise the post-login redirect becomes an open-redirect vector.
function safeRedirectTarget(raw: string | undefined): string {
  const next = raw ?? "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

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
