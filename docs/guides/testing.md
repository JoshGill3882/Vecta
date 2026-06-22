# Testing patterns

Tests run on [Vitest](https://vitest.dev) in a Node environment (server-side
code, no jsdom). This guide covers the project-specific patterns for testing the
server seams, which mostly come down to mocking the Next.js-only dependencies.

**Key files**

- `vitest.config.ts` — environment + module aliases
- `test/` — mirrors the source tree (`test/lib`, `test/app`, `test/scripts`)
- `test/stubs/empty.js` — no-op stand-in for `server-only`

Run with:

```bash
npm test          # one-shot (vitest run)
npm run test:watch
```

## Module aliases (`vitest.config.ts`)

Two aliases make server modules loadable outside a Next build:

- **`server-only` → `test/stubs/empty.js`.** The `server-only` marker only
  resolves inside a Next bundle; the stub makes `import "server-only"` a harmless
  no-op in tests.
- **`@/` → project root.** Mirrors the tsconfig `@/*` path so modules that import
  via `@/...` (e.g. the Server Actions) resolve under the runner.

## Mocking the Next.js / iron-session boundary

`vi.mock` is hoisted above imports, so declare the fakes, then import the code
under test. Patterns used in `test/lib/session.test.ts` and
`test/app/auth-actions.test.ts`:

```ts
// cookies() just needs to hand *something* to getIronSession.
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));

// redirect() throws to unwind rendering — mirror that so you can assert it was
// called AND that code after it doesn't run.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

// Vary the session per test by mocking iron-session directly.
vi.mock("iron-session", () => ({ getIronSession: vi.fn() }));
```

For a Server Action whose `redirect()` fires on success, assert via the throw:

```ts
await expect(loginAction({}, form(PASSWORD))).rejects.toThrow("REDIRECT:/");
expect(mockCreateSession).toHaveBeenCalledOnce();
```

## Resetting module-level state

`src/lib/rate-limit.ts` keeps its failure log in module memory, so isolate tests
by dropping the module cache and re-importing, paired with fake timers to drive
the sliding window (`test/lib/rate-limit.test.ts`):

```ts
beforeEach(() => {
  vi.resetModules(); // fresh module state on next import
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

it("...", async () => {
  const { isRateLimited, recordFailure } = await import("../../src/lib/rate-limit");
  // ...
  vi.advanceTimersByTime(60_000); // expire the window deterministically
});
```

## Testing the proxy

`next/server` works under the Node test environment, so the proxy can be tested
as a plain function: construct a `NextRequest`, mock the session read, and assert
on the returned `NextResponse` (`test/app/proxy.test.ts`).

```ts
import { NextRequest } from "next/server";
vi.mock("@/src/lib/session", () => ({ getSessionFromRequest: vi.fn() }));
import proxy from "../../proxy";

const res = await proxy(new NextRequest(new URL("/tasks", "http://localhost")));
// A redirect sets the Location header; NextResponse.next() sets x-middleware-next.
expect(res.headers.get("location")).toBe("http://localhost/login");
```

> Note: Next's `unstable_doesProxyMatch` helper (for asserting the `matcher`)
> needs the Next runtime and throws an AsyncLocalStorage invariant under plain
> Vitest, so we test the proxy **function's** behavior rather than matcher
> matching.

## Where to put tests

Mirror the source path under `test/`: a module at `src/lib/foo.ts` →
`test/lib/foo.test.ts`; a Server Action under `app/` → `test/app/`. Pure helpers
(no Next/DB deps) need no mocks — see `test/scripts/db-provider.test.ts`.
