# Server Actions

Every task and category mutation runs through a **Server Action** — the server-side
entry point a form (or client component) calls to change data. The actions are a
thin, uniform wrapper around the [service layer](./database.md): they authenticate,
[validate](./validation.md) untrusted input, call one service function, invalidate
the caches that write made stale, and return a **structured result** the caller can
branch on without ever catching an exception.

**Key files:**

- `app/tasks/actions.tsx` — `createTaskAction`, `updateTaskAction`, `deleteTaskAction`
- `app/categories/actions.tsx` — `createCategoryAction`, `updateCategoryAction`, `deleteCategoryAction`
- `src/lib/result.ts` — the `ActionResult<T>` / `FormState<T>` types + `toActionError()` translator
- `src/lib/cache.ts` — `revalidateTasks()` / `revalidateCategories()`, the tag-invalidation helpers

> **`"use server"`.** The directive at the top of each file is what turns every
> exported function into a Server Action. It must be the first line — actions are
> co-located with the routes they serve (`app/tasks/`, `app/categories/`) rather
> than in a shared folder.

## The return contract

Actions never throw to the client. They always return an `ActionResult<T>`, a
discriminated union callers narrow on `ok`:

```ts
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };
```

- **`ok: true`** — `data` holds the DTO the service returned (or `undefined` for a
  delete).
- **`ok: false`** — `error` is a user-facing message. Two optional companions:
  - `code` — a machine-readable code. `"NOT_FOUND"` / `"CONFLICT"` come from an
    anticipated `DomainError`; `"UNAUTHENTICATED"` is returned by the auth gate (see
    below).
  - `fieldErrors` — Zod's field-keyed messages, present when input validation
    failed, so a form can render an error next to each input.

Because the auth check **returns** rather than redirecting, the union is _total_:
every path an action can take produces an `ActionResult`, so a caller never has a
dead branch and never has to catch.

A client renders it like this — no `try/catch` needed:

```tsx
const result = await createTaskAction(formData);
if (!result.ok) {
  // show result.error (and result.fieldErrors under each field, if present)
} else {
  // use result.data (a TaskDTO)
}
```

## The anatomy of an action

Every mutation follows the same five steps. `createTaskAction` is the template:

```ts
"use server";

export async function createTaskAction(
  _prev: FormState<TaskDTO>, // previous state, threaded in by useActionState (unused)
  formData: FormData
): Promise<ActionResult<TaskDTO>> {
  // 1. auth gate — returns a result, never throws/redirects (keeps the union total)
  const session = await getSession();
  if (!session) return { ok: false, error: "You must be signed in", code: "UNAUTHENTICATED" };

  // 2. validate untrusted input against the Zod schema BEFORE the service
  const result = validate(taskCreateSchema, Object.fromEntries(formData));
  if (!result.success)
    return { ok: false, error: "Invalid input", fieldErrors: result.fieldErrors };

  try {
    const data = await createTask(result.data); // 3. call exactly one service fn
    revalidateTasks(); // 4. invalidate the caches this write made stale
    return { ok: true, data }; // 5. structured success
  } catch (e) {
    return toActionError(e); // structured failure — never rethrown to the client
  }
}
```

`update*` actions insert the `id` **before** `_prev` (`(id, _prev, formData)`) and
guard it (`if (!id) return { ok: false, error: "Missing … ID" }`) before validating
the partial body. `delete*` actions take **only an `id`** — see
[Signatures & `useActionState`](#signatures--useactionstate) for why they skip
`_prev`.

### The auth gate returns, it doesn't redirect

Actions call `getSession()` (not `requireSession()`) and **return** an
`UNAUTHENTICATED` result when signed out, rather than throwing a `redirect()`. Two
reasons: it keeps the promise in the ["never throw"](#the-return-contract) contract
literally true, and the real perimeter auth lives in the
[proxy](./authentication.md) — so an action firing while signed out is a _backstop_,
and a backstop is better surfaced as a clean result than as a silent bounce. The
`requireSession()` redirect helper is still the right tool for guarding **pages**.

### Signatures & `useActionState`

The leading `_prev` exists so the create/update actions match the shape React's
[`useActionState`](https://react.dev/reference/react/useActionState) hook calls them
with — `(previousState, formData) => nextState`. The hook feeds each action whatever
it returned last time; on first render that's the initial state. Its type is:

```ts
// src/lib/result.ts
export type FormState<T> = ActionResult<T> | null; // null = idle / not yet submitted
```

One generic alias covers every form — vary only `T`. The `null` is the idle value
for the first render, before any submit has produced an `ActionResult`.

The actions **never read `_prev`** (hence the underscore): each submit recomputes the
full result from auth + validation + service, so nothing carries over. It's accepted
only to satisfy the hook's calling convention.

Three signature shapes, by how each is invoked:

| Action   | Signature               | Why                                                     |
| -------- | ----------------------- | ------------------------------------------------------- |
| `create` | `(_prev, formData)`     | driven by `useActionState`                              |
| `update` | `(id, _prev, formData)` | same, with `id` bound first via `action.bind(null, id)` |
| `delete` | `(id)`                  | **not** driven by `useActionState` — no `_prev` needed  |

`delete` keeps a bare `(id)` because a delete button doesn't need form state,
field-level errors, or progressive-enhancement: it's called directly (e.g. inside a
`useTransition`), so imposing the hook's `(prevState, formData)` shape on it would be
noise. The `_prev` parameter is a requirement of the **hook**, never of being a
Server Action.

### Why validate again when the service also validates?

Deliberate defence-in-depth. The **action** is the primary gate for _users_: it
returns friendly, field-keyed errors a form can render. The **service** runs a
second `schema.parse()` at its own seam that **throws** — a backstop for
non-action callers (future REST routes, scripts) that never ran Zod. Same schema,
two audiences. See [Input validation](./validation.md#how-its-used).

### How errors become results

`toActionError()` is the single translator that keeps step 5 honest:

```ts
export function toActionError(e: unknown): ActionResult<never> {
  if (e instanceof DomainError) {
    // Anticipated (NotFoundError, ConflictError): safe to surface message + code.
    return { ok: false, error: e.message, code: e.code };
  }
  // Unanticipated: log for observability, return a generic message — never leak internals.
  console.error("[action] unexpected error", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}
```

Because services translate Prisma errors (`P2025 → NotFoundError`, `P2002 →
ConflictError`) _before_ they reach the action, the action only ever sees domain
errors or genuine surprises. See [Database & service layer](./database.md).

## Revalidation

After a successful write, the action invalidates the caches that write made stale.
This is centralised in `src/lib/cache.ts` so the actions never hardcode a tag or
path — they call one intent-named helper, and the caching strategy lives in a single
place:

```ts
// src/lib/cache.ts
import { updateTag } from "next/cache";

const tags = {
  tasks: "tasks",
  task: (id: string) => `task-${id}`,
  categories: "categories",
  category: (id: string) => `category-${id}`,
};

export function revalidateTasks(id?: string) {
  updateTag(tags.tasks); // the list
  if (id) updateTag(tags.task(id)); // the item's own detail view
}

export function revalidateCategories(id?: string) {
  updateTag(tags.categories);
  if (id) updateTag(tags.category(id));
  updateTag(tags.tasks); // cross-entity: task rows render their category name/colour
}
```

It's called **only on the success path** — a failed or invalid mutation leaves the
cache untouched.

### Why `updateTag`, and why the `id` is optional

`updateTag` is the Next.js primitive for **read-your-own-writes**: it expires the
tagged entry so the next request re-renders with fresh data (the user sees their
change immediately). It is **Server-Action-only**, which is exactly this call site.
(In a Route Handler you'd reach for `revalidateTag(tag, "max")` instead; the bare
one-argument `revalidateTag(tag)` is deprecated in this version.)

You don't invalidate _what you changed_, you invalidate _what's now stale because_
of it — so the `id` argument targets an item's **existing** detail entry, and
**create omits it** because a brand-new item has no detail entry to bust yet:

| Action | Caches now stale                              | Call                  |
| ------ | --------------------------------------------- | --------------------- |
| create | the list (missing the new row)                | `revalidateTasks()`   |
| update | the list + the item's detail view             | `revalidateTasks(id)` |
| delete | the list + the item's (now-ghost) detail view | `revalidateTasks(id)` |

> **Reads must opt in.** Invalidation only does anything once the read side is
> cached and tagged — e.g. `getTasks()` marked `"use cache"` with
> `cacheTag("tasks")`. Until those pages exist (Phase 4), these calls are harmless
> no-ops; the actions already carry the correct contract so the reads just work when
> they land.

## Tests

The actions are unit-tested in `test/app/task-actions.test.ts` and
`test/app/category-actions.test.ts`. The tests keep `validate()`, the Zod schemas,
**and the real `src/lib/cache.ts` helper** in play (so the validation gate and the
exact tag logic are genuinely exercised) and fake only the true side effects —
`getSession`, the service module, and `next/cache`'s `updateTag` — via `vi.mock`.
They cover the full contract:

- **Wrapping** — a valid call invokes the matching service function exactly once.
- **Validation** — invalid input returns `fieldErrors` and the service is never
  called.
- **Result shape** — success yields `{ ok: true, data }`; a `DomainError` yields
  `{ ok: false, error, code }`; an unexpected error yields the generic message; a
  signed-out call yields `{ ok: false, code: "UNAUTHENTICATED" }` — **nothing is ever
  thrown**.
- **Revalidation** — the right tags are invalidated on success (`create` → list tag
  only; `update`/`delete` → list + `id` tag; category writes additionally bust
  `"tasks"`), and _nothing_ is invalidated on a validation failure or a service
  error.
- **Previous state** — actions ignore `_prev`; each submit recomputes from scratch.

Mocking `updateTag` (rather than the helper) lets the tests verify the real tag
names and the create-vs-update/delete distinction end-to-end. For the suite's
broader conventions, see [Testing patterns](./testing.md).
