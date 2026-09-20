import "server-only"; // "Side-Effect" style import - activates on all contents of module
import { getIronSession, IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

/** What the encrypted session cookie holds. */
interface SessionData {
  /** True once a password has been accepted; the only thing the app checks. */
  isLoggedIn: boolean;
}

/** Cookie settings, in one place.
 *
 * The action path and the proxy path both decrypt the same cookie, and only
 * the name and the password take part in that. Defining them twice is how the
 * two ends come to disagree about a cookie neither can then read.
 */
const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "", // Will never hit a Null error due to pre-load checks
  cookieName: "Vecta-Auth",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production", // dev runs over plain http
  },
};

/** Reads the session from the request cookies, logged in or not.
 *
 * @returns The session object, whose `isLoggedIn` may be false.
 */
async function getRawSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/** Marks the session logged in and writes the encrypted cookie. */
export async function createSession(): Promise<void> {
  const session = await getRawSession();
  session.isLoggedIn = true;
  await session.save(); // ← writes the encrypted Set-Cookie header
}

/** The current session, if there is one.
 *
 * @returns The session, or null when nobody is logged in.
 */
export async function getSession(): Promise<IronSession<SessionData> | null> {
  const session = await getRawSession();
  if (!session.isLoggedIn) return null;
  return session;
}

/** The current session, redirecting to the login page when there is none.
 *
 * @returns The session. The null in the type is unreachable - `redirect`
 *   throws - and is kept because the compiler cannot see that.
 */
export async function requireSession(): Promise<IronSession<SessionData> | null> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Clears the session and expires its cookie. */
export async function destroySession(): Promise<void> {
  const session = await getRawSession();
  session.destroy(); // ← clears data + emits an expiring Set-Cookie header
  // Note: no `isLoggedIn = false` needed — destroy() wipes the whole session
}

/** Read-only session check for the proxy.
 *
 * Reads the cookie off the request rather than through `next/headers`, which
 * is only contractual in Server Components, Server Functions and Route
 * Handlers. The Response passed to iron-session is a throwaway: the perimeter
 * only ever reads, so nothing is written back.
 *
 * @param req The incoming request.
 * @returns The session data, or null when nobody is logged in.
 */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionData | null> {
  const session = await getIronSession<SessionData>(req, new Response(), sessionOptions);
  return session.isLoggedIn ? session : null;
}
