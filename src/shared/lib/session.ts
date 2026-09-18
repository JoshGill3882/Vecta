import "server-only"; // "Side-Effect" style import - activates on all contents of module
import { getIronSession, IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

interface SessionData {
  isLoggedIn: boolean;
}

// Single source of truth for the cookie settings so the action path
// (getRawSession) and the proxy path (getSessionFromRequest) can never decrypt
// with mismatched options — only cookieName + password matter for decryption.
const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "", // Will never hit a Null error due to pre-load checks
  cookieName: "Vecta-Auth",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production", // dev runs over plain http
  },
};

// Private, reusable function for getting the raw output from "getIronSession()"
async function getRawSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
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

export async function destroySession(): Promise<void> {
  const session = await getRawSession();
  session.destroy(); // ← clears data + emits an expiring Set-Cookie header
  // Note: no `isLoggedIn = false` needed — destroy() wipes the whole session
}

// Read-only session check for the proxy. Reads the cookie off the NextRequest
// (the supported way to read cookies in a proxy) rather than next/headers, which
// is only contractual in Server Components/Functions/Route Handlers. We pass a
// throwaway Response because the perimeter only reads — it never save()s.
export async function getSessionFromRequest(req: NextRequest): Promise<SessionData | null> {
  const session = await getIronSession<SessionData>(req, new Response(), sessionOptions);
  return session.isLoggedIn ? session : null;
}
