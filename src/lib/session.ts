import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

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
