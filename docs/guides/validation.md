# Input validation

All task and category input is validated with [Zod](https://zod.dev/) schemas at the server boundary.
A schema is the single source of truth for both **run-time validation** and the **TypeScript type** of an input — `z.infer` derives the type from the schema, so the two can never drift apart.

**Key files:**

- `src/lib/schemas/tasks.ts` — `taskCreateSchema`, `taskUpdateSchema`
- `src/lib/schemas/categories.ts` — `categoryCreateSchema`, `categoryUpdateSchema`
- `src/lib/validation.ts` — the shared `validate()` helper + `ValidationResult` type

> **Zod 4.** Some APIs differ from older tutorials:
> id/string formats like `z.cuid()` are **top-level** (not `z.string().cuid()`), and error flattening is `z.flattenError(err)` (the old `err.flatten()` is deprecated).

## The schemas

Each model has a **create** schema and an **update** schema.
The update schema is derived with `.partial()` rather than retyped, so every field becomes optional while keeping the exact same rules — change a rule once and both honour it.

```ts
// tasks.ts — statuses are a single source of truth, reused by the enum and the UI
export const TASK_STATUSES = ["open", "in_progress", "closed"] as const;

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120, "..."),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(TASK_STATUSES),
  categoryId: z.cuid().nullable().optional(), // string = assign, null = unassign, omitted = leave
});
export const taskUpdateSchema = taskCreateSchema.partial();
```

Two conventions worth knowing:

- **`.trim()` comes before length checks**, so `"   "` is treated as empty and the parsed output is the cleaned string (`.trim()` transforms, not just validates).
- **Field name is `color`, not `colour`** — it must match the Prisma column.
  The schema rejects anything but a 6-digit hex (`#rrggbb`);
  3-digit shorthand and named colours are intentionally rejected.

### Types

The inferred types are exported alongside each schema — import these instead of hand-writing input interfaces:

```ts
import type { TaskCreateInput, CategoryCreateInput } from "@/src/lib/schemas/tasks";
```

## The `validate()` helper

Calling `safeParse` directly works, but every call site would then re-flatten errors its own way.
`validate()` centralises that into one structured shape so the whole app reports errors identically.

```ts
import { z } from "zod";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: Record<string, string[]>; formErrors: string[] };

export function validate<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T>;
```

- `fieldErrors` — keyed by field name, e.g. `{ title: ["Title is required"] }`.
  A key only appears when that field has errors.
- `formErrors` — cross-field / object-level issues (those raised by `.refine()` on the object rather than a single field).

It returns a **discriminated union**:
branch on `success` and TypeScript narrows to either `data` (typed) or the error buckets — never both.

## How it's used

The Server Action is the **primary** gate:
it validates untrusted input and returns friendly, field-keyed errors the form renders.
Services then run a lightweight defensive `schema.parse(input)` at their own boundary — a second line of defence for non-action callers (future REST routes, scripts) that **throws** rather than returning the friendly shape.
Same schema, two audiences: the action validates for the _user_, the service for the _programmer_.
See [Database & service layer](./database.md#defensive-validation-at-the-seam).

```ts
"use server";
import { validate } from "@/src/lib/validation";
import { taskCreateSchema } from "@/src/lib/schemas/tasks";

export async function createTaskAction(_prev: unknown, formData: FormData) {
  const result = validate(taskCreateSchema, Object.fromEntries(formData));
  if (!result.success) {
    return { fieldErrors: result.fieldErrors }; // render next to each field
  }
  await createTask(result.data); // result.data is typed as TaskCreateInput
  // ...revalidatePath(), redirect, etc.
}
```

## What validation does _not_ cover

- **Uniqueness** (e.g. a category `name` must be unique) is a database concern, not a shape concern — enforce it in the service layer and translate the resulting DB error, since a schema can't know what other rows exist.
- **Authentication** is not input-shape validation.
  The login action checks a credential against a secret and deliberately returns a single vague message;
  it does **not** use these schemas or `validate()`.
  See [Authentication & sessions](./authentication.md).

## Tests

The schemas and helper are unit-tested with Vitest:

- `test/lib/schemas/tasks.test.ts`, `test/lib/schemas/categories.test.ts` — one valid baseline per model, then one broken field per test;
  `it.each` tables drive the status enum and the valid/invalid colour cases.
- `test/lib/validation.test.ts` — the `validate()` contract:
  typed data on success, field-keyed errors on failure, absent keys for valid fields, and `formErrors` for cross-field `.refine()` issues.

For the suite's broader patterns, see [Testing patterns](./testing.md).
