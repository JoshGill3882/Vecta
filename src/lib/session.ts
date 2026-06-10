import "server-only"; // "Side-Effect" style import - activates on all contents of module
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

interface SessionData {
  isLoggedIn: boolean;
}

export async function getSession() {
  const session = await getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_SECRET || "", // 2nd Option will never be hit due to checks on app start
    cookieName: "Task-Manager-Auth",
  });
  if (!session.isLoggedIn) return null;
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
}
