"use server";

import { destroySession } from "@/src/shared/lib/session";
import { redirect } from "next/navigation";

/** Server Action for signing out, which clears the session and redirects. */
export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
