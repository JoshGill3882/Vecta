"use server";

import { signOut } from "@/src/server/services/auth";
import { redirect } from "next/navigation";

/** Server Action for signing out, which clears the session and redirects. */
export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
