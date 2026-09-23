# Testing patterns

Tests run on [Vitest](https://vitest.dev), split across three projects: server-side code in a Node environment, and React components in jsdom.
This guide covers the project-specific patterns — which mostly come down to mocking the Next.js-only dependencies.

## Key files

- `vitest.config.ts` — three projects (`unit`, `integration`, `component`) + shared module aliases
- `test/` — mirrors the source tree (`test/shared`, `test/features`, `test/scripts`)
- `test/integration/` — real-database integration project (`setup.ts` + `*.int.test.ts`)
- `test/component/setup.ts` — Testing Library cleanup between component specs
- `test/stubs/empty.js` — no-op stand-in for `server-only`

Run with:

```bash
npm test                              # all three projects
npm run test:watch
npx vitest run --project integration  # one project only
```

## Module aliases (`vitest.config.ts`)

Two aliases make server modules loadable outside a Next build:

- **`server-only` → `test/stubs/empty.js`.** The `server-only` marker only resolves inside a Next bundle;
  the stub makes `import "server-only"` a harmless no-op in tests.
- **`@/` → project root.** Mirrors the tsconfig `@/*` path so modules that import via `@/...` (e.g. the Server Actions) resolve under the runner.

## Mocking the Next.js / iron-session boundary

`vi.mock` is hoisted above imports, so declare the fakes, then import the code under test.
Patterns used in `test/shared/lib/session.test.ts` and `test/features/auth/actions.test.ts`:

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

`src/features/auth/lib/rate-limit.ts` keeps its failure log in module memory, so isolate tests by dropping the module cache and re-importing, paired with fake timers to drive the sliding window (`test/features/auth/rate-limit.test.ts`):

```ts
beforeEach(() => {
  vi.resetModules(); // fresh module state on next import
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

it("...", async () => {
  const { isRateLimited, recordFailure } = await import("../../src/features/auth/lib/rate-limit");
  // ...
  vi.advanceTimersByTime(60_000); // expire the window deterministically
});
```

## Testing the proxy

`next/server` works under the Node test environment, so the proxy can be tested as a plain function:
construct a `NextRequest`, mock the session read, and assert on the returned `NextResponse` (`test/proxy.test.ts`).

```ts
import { NextRequest } from "next/server";
vi.mock("@/src/shared/lib/session", () => ({ getSessionFromRequest: vi.fn() }));
import proxy from "../../proxy";

const res = await proxy(new NextRequest(new URL("/tasks", "http://localhost")));
// A redirect sets the Location header; NextResponse.next() sets x-middleware-next.
expect(res.headers.get("location")).toBe("http://localhost/login");
```

> Note: Next's `unstable_doesProxyMatch` helper (for asserting the `matcher`) needs the Next runtime and throws an AsyncLocalStorage invariant under plain Vitest, so we test the proxy **function's** behavior rather than matcher matching.

## Integration tests (real database)

Most specs are **unit** tests that mock their collaborators.
A second Vitest **project** holds **integration** tests that drive the genuine stack — Server Action → `validate()` → service → Prisma → a real database — so they catch what mocks can't:
real Prisma error translation (`P2003`/`P2025`/`P2002` → `NotFoundError`/`ConflictError`) and schema behaviour like `onDelete: SetNull`.

- **Database — in-memory SQLite.** The integration project sets `DATABASE_URL=file::memory:` (the `file:` prefix is required so the provider resolver detects SQLite; the adapter strips it back to `:memory:`).
  Nothing hits disk, and the DB is discarded when the worker exits — so it is created and torn down every run for free.
- **Schema — replayed migrations.** `test/integration/setup.ts` executes the committed migration SQL (`prisma/migrations/sqlite/**`) through the app's own connection.
  `prisma migrate deploy` can't be used:
  it runs in a separate process and would populate a _different_ in-memory DB than the tests connect to.
- **Isolation — per test.** `beforeEach` clears every row (tasks → categories, FK-safe order).
  A guard refuses to run unless `DATABASE_URL` is in-memory, so a real database can never be wiped.
  `PRAGMA foreign_keys = ON` is set in setup — the FK-violation and SetNull tests depend on it.
- **What's mocked — only the Next edges.** `getSession` (auth) and `updateTag` (cache); the DB and services are real.

Specs live in `test/integration/*.int.test.ts` (`tasks`, `categories`).

## Component tests (React in jsdom)

A third project renders components with [Testing Library](https://testing-library.com/docs/react-testing-library/intro/) in a jsdom environment.
It covers what the other two cannot: whether the right branch renders, what a control is labelled, and where focus lands.

- **Where they live.** Beside the other specs for the same source, mirroring the source path — `src/features/tasks/components/tasks-view.tsx` → `test/features/tasks/tasks-view.test.tsx`.
- **Naming is the selector.** The `component` project collects `test/**/*.test.tsx` and the `unit` project collects `test/**/*.test.ts`, so the extension alone decides which environment a spec runs in.
  There is no overlap and nothing to configure per file — a `.ts` spec never pays for jsdom, and a `.tsx` spec always gets it.
- **Cleanup is explicit.** Testing Library only unmounts between tests automatically when Vitest runs with globals enabled, and this suite imports its helpers explicitly instead.
  `test/component/setup.ts` calls `cleanup` in an `afterEach`; without it the previous render stays in the document and the next query finds two of everything.

### Mocking `next/navigation`

Any Client Component that reaches the router needs it stubbed, and the reach is often indirect — `TasksView` never imports `next/navigation`, but `useServerAction` does, and calls `router.refresh()` after every action.
Mock the module rather than the hook, so it covers both cases:

```tsx
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
```

Two more boundaries usually need the same treatment:

- **Server Actions.** The action modules reach Prisma through the service layer, which cannot load in jsdom — stub every action the component can invoke.
- **`sonner`.** Toasts render into a portal the component under test does not mount, so assertions would have nothing to find.

Because `vi.mock` is hoisted, import the component **after** the mocks — `const { TasksView } = await import("…")` — or the real modules load first.

### A re-render is how a refresh is observed

`router.refresh()` is mocked, so nothing re-fetches.
Where a component reacts to fresh data — an effect keyed on a prop — drive it by rerendering with the new props yourself:

```tsx
const view = render(<TasksView tasks={[task()]} {...rest} />);
// …delete the only task…
view.rerender(<TasksView tasks={[]} {...rest} />);
expect(document.activeElement).toBe(document.getElementById(tasksEmptyStateHeadingId));
```

`test/features/tasks/tasks-view.test.tsx` is the reference for all of this.

### No React plugin

`vitest.config.ts` has no `@vitejs/plugin-react`.
Vite's esbuild reads `jsx: "react-jsx"` from `tsconfig.json` and transforms `.tsx` with the automatic runtime, which is all a test needs — the plugin's remaining job is Fast Refresh, which does not apply here.
Leaving it out also avoids a genuine dependency conflict: the plugin pulls Babel 8 through `@rolldown/plugin-babel`, while `shadcn` pins Babel 7, and npm cannot satisfy both.

`test/component/environment.test.tsx` is a canary for exactly this.
It asserts nothing about the app, only that JSX still transforms and renders — so when a toolchain upgrade breaks the arrangement, it fails with an obvious message rather than a real spec failing for a reason that looks like its own.

## Prefer a pure module where the logic allows

Being able to render a component is not a reason to test logic through one.
Rendering is slower, and an assertion about matching rules made through a rendered list fails for many reasons that have nothing to do with the rules.

Keep the logic out of the component where it will go: extract it into a pure module — the feature's own `lib/`, or `src/shared/lib/` where more than one feature needs it — and test that directly.
`src/features/tasks/lib/task-search.ts` is the reference.
The task list's matching and highlighting rules live there as plain functions over `TaskDTO[]`, and `test/features/tasks/task-search.test.ts` covers them with no mocks at all.
`tasks-view.tsx` keeps the wiring: state, memoisation, and what renders.

Draw the line at the edge cases.
If a rule has one worth pinning down — a literal `.*` that must not behave as a wildcard, a query of pure whitespace, a string whose length changes when lowercased — it belongs in the module.
What belongs in a component spec is what only exists once it renders: which branch was taken, how something is labelled, and where focus went.

## Where to put tests

Mirror the source path under `test/`: `src/shared/lib/session.ts` → `test/shared/lib/session.test.ts`.
Inside a feature the mirror stops at the feature — `src/features/tasks/lib/task-search.ts` →
`test/features/tasks/task-search.test.ts` — because a feature has few enough specs that repeating its
internal folders would leave directories holding one file.
Sources at the repository root are mirrored at the top of `test/`.
Pure helpers (no Next/DB deps) need no mocks — see `test/scripts/db-provider.test.ts`.
Integration specs (real DB) go in `test/integration/` as `*.int.test.ts`.
Component specs use `.test.tsx`, which is what puts them in the jsdom project.
