import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/src/lib/session";

// Routes reachable without a session. Everything else is treated as protected.
const PUBLIC_ROUTES = ["/login"];

// Optimistic auth check (Next.js 16 "Proxy", formerly Middleware). Runs before
// every matched request and only reads/decrypts the session cookie — no DB work,
// per the docs' guidance for proxy-level checks. This is the perimeter, NOT the
// real guard: each protected page must still call requireSession() (the DAL).
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.includes(path);

  // Reads + decrypts the session cookie straight off the request; null unless it
  // decrypts to a logged-in session.
  const session = await getSessionFromRequest(req);

  // Unauthenticated request for a protected route → send to the login page.
  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Already authenticated but sitting on a public route (e.g. /login) → send home.
  if (session && isPublicRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Skip API routes (they self-authorize), Next internals, and any path with a
  // file extension (static assets in /public such as the .svg files).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
