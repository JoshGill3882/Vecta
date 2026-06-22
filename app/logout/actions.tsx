"use server";

import { destroySession } from "@/src/lib/session";
import { redirect } from "next/navigation";

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
