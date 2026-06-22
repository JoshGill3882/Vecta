"use server"; // ← THIS is what turns every export below into a Server Action

import { isRateLimited, recordFailure } from "@/src/lib/rate-limit";
import { timingSafeEqual } from "node:crypto";
import { createSession } from "@/src/lib/session";
import { redirect } from "next/navigation";

export interface LoginState {
  error?: string;
}

export async function loginAction(prevState: LoginState, formData: FormData): Promise<LoginState> {
  if (isRateLimited()) return { error: "Too many attempts. Retry in a minute" };

  // Extract password from form data
  const password = formData.get("password")?.toString() ?? "";

  // If the passwords don't match, return an error
  if (
    !timingSafeEqual(
      Buffer.alloc(5, password),
      Buffer.alloc(5, process.env.ADMIN_PASSWORD!) // Will never hit a Null error due to pre-load checks
    )
  ) {
    recordFailure();
    return { error: "Password Invalid" };
  }

  await createSession();
  redirect("/");
}
