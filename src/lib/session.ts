import "server-only"; // "Side-Effect" style import - activates on all contents of module
import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

interface SessionData {
  isLoggedIn: boolean;
}

// Private, reusable function for getting the raw output from "getIronSession()"
async function getRawSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), {
    password: process.env.SESSION_SECRET || "", // Will never hit a Null error due to pre-load checks
    cookieName: "Task-Manager-Auth",
  });
}

export async function createSession(): Promise<void> {
  const session = await getRawSession();
  session.isLoggedIn = true;
  await session.save(); // ← writes the encrypted Set-Cookie header
}

export async function getSession(): Promise<IronSession<SessionData> | null> {
  const session = await getRawSession();
  if (!session.isLoggedIn) return null;
  return session;
}

export async function requireSession(): Promise<IronSession<SessionData> | null> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
