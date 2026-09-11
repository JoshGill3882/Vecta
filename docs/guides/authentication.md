# Authentication & sessions

The app uses **single-admin** auth: one password, supplied via the
`ADMIN_PASSWORD` env var, with no user table. A successful login stores an
encrypted, signed cookie (via [iron-session](https://github.com/vvo/iron-session));
there is no server-side session store.

## Key files

- `src/lib/session.ts` — the session helper API (use this everywhere)
- `proxy.ts` — the request perimeter
- `app/login/actions.tsx`, `app/logout/actions.tsx` — the auth Server Actions
- `app/login/login-form.tsx` — the client form pattern

## The two-layer model (read this first)

Auth is enforced in **two independent layers**, and you must respect both:

1. **`proxy.ts` — the perimeter.** Runs before matched requests and does an
   _optimistic_ check: it reads the session cookie (via `getSessionFromRequest`,
   straight off the request) and redirects unauthenticated traffic to `/login`.
   It does **no** database work and is **not** a guard you can rely on alone.
2. **`requireSession()` — the real guard (DAL).** Every protected page and
   Server Action must call it itself.

Why both? The proxy `matcher` (`proxy.ts`) excludes paths, and per the Next.js
proxy docs a matcher that skips a path **also skips Server Functions on that
path** — so a refactor can silently remove perimeter coverage. The in-component
`requireSession()` call is what actually keeps a route private.

> **Rule of thumb:** never let the proxy be the _only_ thing standing between a
> request and protected data. Guard in the page/action too.

## Session helper API (`src/lib/session.ts`)

```ts
// Returns the session, or null if there is no logged-in session.
getSession(): Promise<IronSession<SessionData> | null>

// Returns the session, or redirect()s to /login (throws) if not logged in.
// Use at the top of any protected page or Server Action.
requireSession(): Promise<IronSession<SessionData> | null>

// Marks the session logged in and writes the Set-Cookie header.
createSession(): Promise<void>

// Clears the session and emits an expiring Set-Cookie header.
destroySession(): Promise<void>

// Read-only check for the proxy: reads + decrypts the cookie straight off the
// NextRequest (proxies can't rely on next/headers). Returns the data, or null.
getSessionFromRequest(req: NextRequest): Promise<SessionData | null>
```

`SessionData` is currently just `{ isLoggedIn: boolean }`. The cookie is named
`Vecta-Auth` and encrypted with `SESSION_SECRET`.

## How to protect a page (Server Component)

```tsx
import { requireSession } from "@/src/lib/session";

export default async function SettingsPage() {
  await requireSession(); // redirects to /login if not authenticated
  // ...render protected content
}
```

See `app/(app)/page.tsx` for the canonical example.

## How to protect a Server Action

The proxy does not reliably cover Server Functions (see above), so guard
explicitly:

```tsx
"use server";
import { requireSession } from "@/src/lib/session";

export async function deleteEverything() {
  await requireSession(); // throws (redirects) if not logged in
  // ...mutate
}
```

## How to read auth state without redirecting

Use `getSession()` when you want to branch rather than bounce — e.g. the login
page sends already-authenticated users home instead of showing the form
(`app/login/page.tsx`):

```tsx
if (await getSession()) redirect("/");
```

## The login/logout flow

- **Login** (`app/login/actions.tsx`) is a Server Action that rate-limits
  attempts (see [Rate limiting](./rate-limiting.md)), compares the submitted
  password against `ADMIN_PASSWORD` via `passwordMatches` (SHA-256 digests +
  `crypto.timingSafeEqual`), calls `createSession()`, then redirects to the
  post-login destination — the `next` form field validated by
  `safeRedirectTarget`, falling back to `/`.
- **Logout** (`app/logout/actions.tsx`) calls `destroySession()` then
  `redirect("/login")`.
- The form (`app/login/login-form.tsx`) is the reference pattern for any
  action-backed form: `useActionState(action, initialState)` drives the returned
  error state and a `pending` flag, and the action's return type
  (`LoginState = { error?: string }`) is the error shape rendered inline. Note
  `redirect()` throws to unwind, so it must be the **last** statement on the
  success path.

## Configuration

| Var              | Purpose                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| `ADMIN_PASSWORD` | The single admin password, compared on each login.                          |
| `SESSION_SECRET` | ≥32 chars; encrypts/signs the cookie. Generate with `openssl rand -hex 32`. |

Both are required at boot — see [Environment & boot-time contract](./environment.md).

## Design notes

These call out decisions that are easy to get wrong if you extend the auth code.

- **The `secure` cookie flag is environment-gated.** iron-session defaults
  `cookieOptions.secure` to `true`, which browsers drop over plain `http://` on
  any non-`localhost` origin (e.g. a LAN IP) — presenting as a login that
  silently bounces back to `/login`. `sessionOptions` in `session.ts` sets
  `secure: process.env.NODE_ENV === "production"`, so dev works over http while
  production (behind HTTPS termination) stays locked down.
- **The proxy reads cookies from the request, not `next/headers`.** `cookies()`
  is only contractual in Server Components / Server Functions / Route Handlers,
  so the perimeter uses `getSessionFromRequest(req)` — the iron-session
  `(req, res, options)` overload — instead. Both paths share one `sessionOptions`
  constant so they can never decrypt with mismatched `cookieName`/`password`.
- **Password comparison is timing-safe over the full value.** `passwordMatches`
  hashes both sides to equal-length SHA-256 digests before `timingSafeEqual`, so
  the comparison never throws on a length mismatch and doesn't leak length.
- **Post-login `next` is open-redirect-guarded.** The proxy captures the bounced
  path as `?next=`, but the action treats it as untrusted: `safeRedirectTarget`
  only honours same-origin absolute paths and rejects `//host` / `/\host`,
  falling back to `/`. Never pass a `next` value to `redirect()` unchecked.
