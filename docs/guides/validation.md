# Input validation

All task and category input, every log entry, the log's retention, and the Logs page's query string are validated with [Zod](https://zod.dev/) schemas at the server boundary.
A schema is the single source of truth for both **run-time validation** and the **TypeScript type** of an input — `z.infer` derives the type from the schema, so the two can never drift apart.

**Key files:**

- `src/shared/lib/schemas/tasks.ts` — `taskCreateSchema`, `taskUpdateSchema`
- `src/shared/lib/schemas/categories.ts` — `categoryCreateSchema`, `categoryUpdateSchema`
- `src/shared/lib/schemas/logs.ts` — `logWriteSchema` and `logFiltersSchema`, with the `LOG_KINDS`, `LOG_LEVELS` and `LOG_SOURCES` lists and `LOG_PAGE_SIZE`
- `src/shared/lib/schemas/settings.ts` — `logRetentionDaysSchema`, with the `LOG_RETENTION_DAYS` list and `DEFAULT_LOG_RETENTION_DAYS`
- `src/shared/lib/validation.ts` — the shared `validate()` helper + `ValidationResult` type

> **Zod 4.** Some APIs differ from older tutorials:
> id/string formats like `z.cuid()` are **top-level** (not `z.string().cuid()`), and error flattening is `z.flattenError(err)` (the old `err.flatten()` is deprecated).

## The schemas

Tasks and categories each have a **create** schema and an **update** schema.
The update schema is derived with `.partial()` rather than retyped, so every field becomes optional while keeping the exact same rules — change a rule once and both honour it.

```ts
// tasks.ts — statuses are a single source of truth, reused by the enum and the UI
export const TASK_STATUSES = ["open", "in_progress", "closed"] as const;

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120, "..."),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(TASK_STATUSES),
  categoryId: z.cuid().nullable().optional(), // string = assign, null = unassign, omitted = leave
  dueAt: dueAtSchema.nullable().optional(), // the same three shapes, for a due date
});
export const taskUpdateSchema = taskCreateSchema.partial();
```

A log entry is written once and never edited, so it has a single **write** schema.
Its `kind` and `level` come from `LOG_KINDS` and `LOG_LEVELS`, the same `as const` pattern as `TASK_STATUSES`;
`LogKind` and `LogLevel` in `src/shared/lib/dtos/logs.ts` are derived from those lists rather than retyped.
`LOG_LEVELS` runs from least to most severe, and the order is part of the contract: a minimum level keeps every level at or after its position.
An `event` must be lowercase words joined by dots (`task.deleted`, `action.unexpected_error`), at least two of them, and `detail` must be an object, never a bare value.

The log's retention is one value, not an object: `logRetentionDaysSchema` is `z.literal(LOG_RETENTION_DAYS)`, the days 7, 30, 90 and 365, and 0 for forever.
A list of literals rather than a number with a range, because only those choices are offered, and `LogRetentionDays` is derived from the same list.
It takes numbers only, refusing the text `"30"` rather than coercing it, since a coerced empty string would read as 0 and quietly mean forever.

Two conventions worth knowing:

- **`.trim()` comes before length checks**, so `"   "` is treated as empty and the parsed output is the cleaned string (`.trim()` transforms, not just validates).
- **Field name is `color`, not `colour`** — it must match the Prisma column.
  The schema rejects anything but a 6-digit hex (`#rrggbb`);
  3-digit shorthand and named colours are intentionally rejected.

### Types

The inferred types are exported alongside each schema — import these instead of hand-writing input interfaces:

```ts
import type { TaskCreateInput, CategoryCreateInput } from "@/src/shared/lib/schemas/tasks";
import type { LogWriteInput } from "@/src/shared/lib/schemas/logs";
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
import { validate } from "@/src/shared/lib/validation";
import { taskCreateSchema } from "@/src/shared/lib/schemas/tasks";

export async function createTaskAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  // ...auth gate first
  const result = validate(taskCreateSchema, input);
  if (!result.success) {
    return { ok: false, error: "Invalid input", fieldErrors: result.fieldErrors };
  }
  const data = await createTask(result.data); // result.data is typed as TaskCreateInput
  // ...revalidate, then return { ok: true, data }
}
```

The form places each of those messages under the field it names, and reports anything it cannot place some other way; see [Forms](./ui.md#forms).
The whole action is in [Server Actions](./server-actions.md#the-anatomy-of-an-action).

`logWriteSchema` has only the programmer audience.
Log entries are written by server code, never typed by the user, so nothing calls `validate()` with it;
`writeLog` parses it and throws on a malformed entry, which is a bug in the code that wrote it.

`logFiltersSchema` reads the Logs page's query string, which anyone can edit, and it never refuses one.
Next passes a parameter given once as a string and a repeated one as an array, so each is read as a list first.
An unknown level or source then clears that filter, and a page that is not a whole number from 1 reads as the first, so a stale or hand-edited link shows the log rather than an error.
The page calls `parse` rather than `validate()`, since there is no error to report.
Writing an address from the filters is the other direction, done by `logsHref` in `src/features/logs/lib/log-links.ts`, and its tests read every address it writes back through this schema.

`logRetentionDaysSchema` has both audiences and one more.
`setLogRetentionAction` validates the card's choice with `validate()` and refuses anything else as `Invalid input`; `setLogRetention` parses it again at the service.
The third is the database: `toSettingsDTO` reads the stored value through `safeParse`, and a value that is not one of the choices reads as the default, so a row edited by hand cannot stop the Logs page from showing.

## What validation does _not_ cover

- **Uniqueness** (e.g. a category `name` must be unique) is a database concern, not a shape concern — enforce it in the service layer and translate the resulting DB error, since a schema can't know what other rows exist.
- **Authentication** is not input-shape validation.
  The login action checks a credential against a secret and deliberately returns a single vague message;
  it does **not** use these schemas or `validate()`.
  See [Authentication & sessions](./authentication.md).

## Tests

The schemas and helper are unit-tested with Vitest:

- `test/shared/lib/schemas/tasks.test.ts`, `test/shared/lib/schemas/categories.test.ts` — one valid baseline per model, then one broken field per test;
  `it.each` tables drive the status enum and the valid/invalid colour cases.
- `test/shared/lib/schemas/logs.test.ts` — the same pattern for `logWriteSchema`:
  every kind and level, the order of the levels, the event-name shape, and `detail` as an object only.
  `logFiltersSchema` has its own cases: a parameter left out, given once or repeated, and each way a value can be wrong.
- `test/shared/lib/schemas/settings.test.ts` — every retention choice accepted, and the near-misses refused: other numbers, fractions, and the choices as text.
- `test/shared/lib/validation.test.ts` — the `validate()` contract:
  typed data on success, field-keyed errors on failure, absent keys for valid fields, and `formErrors` for cross-field `.refine()` issues.

For the suite's broader patterns, see [Testing patterns](./testing.md).
