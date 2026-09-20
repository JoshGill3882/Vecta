# Comments & documentation

What carries a doc block, how one is shaped, and what a comment is allowed to say.

A comment explains what the reader cannot get from the code itself.
Code says what happens; a comment says what it is for, and why it is built this way rather than the obvious way.
Prose that only restates the code earns nothing, and a comment that stops being true is worse than no comment at all — a reader cannot tell a stale one from a current one, so a single wrong comment devalues every other comment in the file.

## What carries a block

Three things, and the rule is structural rather than a judgement about whether a name is self-explanatory.

**Every named function or class.**
Exported or not, at module scope or defined inside a component.
Either is an interface — it has parameters, a result and a contract — and something somewhere calls it.

**Every module-scope binding.**
Constants and types declared at the top level of a file, exported or not.

**Every member of an exported type.**
Its members are its interface, read by people who never open the file it is declared in.
A type that is not exported is read beside the code using it, so its members are documented only where they need it.

Two things carry nothing:

**Inline and anonymous callbacks.**
An arrow function handed straight to a prop or a handler is part of the expression it sits in, and a block above it would break the line it belongs to.

**Anything at module scope in a spec.**
No spec imports another, so its constants and fixtures are local to their file whatever scope they sit in, and a line restating the name of a `vi.mocked` alias is the noise this guide warns about elsewhere. Helper functions in a spec still carry blocks.

**Local values inside a function body.**
A local has one scope, no callers, and its definition is the expression beside it.
`const narrowed = isNarrowing(narrowing)` is not improved by a line above it explaining that it is whether anything is narrowing.
A function declared inside another is not local in this sense: it is still a function, still has callers, and still carries a block.

```tsx
/** DOM id of the search input, and the last focus target after a delete. */
export const tasksSearchFieldId = "tasks-search-field";

/** Everything the task list narrows by, in one value. */
export type TaskNarrowing = {
  /** Already normalised. Empty means "no query", never "match nothing". */
  needle: string;
  /** Selected category ids, where `null` is the Uncategorised option. */
  categoryIds: ReadonlySet<string | null>;
};
```

### Why the rule is structural

A block appearing only where someone judged one necessary leaves the reader unable to tell a function that was considered and dismissed from one that was simply missed.
Completeness is itself information: when the rule admits no exceptions, silence means something.

It is also what makes the rule enforceable rather than aspirational.
"Every named function" and "module scope, not a function body" are both things a linter can check.
"Wherever the name does not carry it" is not, and never will be.

## The shape of a block

```ts
/** One-line summary, readable when the block is folded.
 *
 * A further paragraph where the name and summary do not carry it — the
 * constraint that is not obvious, the reason for the approach taken.
 *
 * @param one per parameter, named as the signature names it
 * @returns where the function returns a value
 * @throws wherever the function throws
 */
```

The summary **shares the block's opening line**.
A folded block shows only its first physical line, so a block whose first line carries nothing but the opening delimiter folds to nothing useful, while one that opens with its summary stays readable collapsed.
Hover shows the summary either way; folding does not.

The summary is a sentence and ends with a full stop.
The paragraph beneath it is optional, and belongs there when the name and the summary between them still leave something to explain.

### How long a block is

**Depth follows the interface, not the importance.**
A function with no parameters and no return value takes one line, because there is nothing to list:

```tsx
/** Opens the task dialog with no task loaded, ready to create one. */
function openCreate() {
  // ...
}
```

That block earns itself on four words — _with no task loaded_ — which the name does not say.
If the summary you write is only the name in longer words, the problem is the summary rather than the rule: say what the function is for, what it assumes, or what it leaves to the caller.

A function being small does not shorten its block.
`toggle(id)` is a handful of lines and still carries a `@param`, because it still has a parameter a caller has to pass.

## Tags

**Every function documents its full interface** — a `@param` for each parameter, and a `@returns` where it returns a value.
Exported or not: a reader inside the module is as entitled to a complete list as one outside it.

A block listing two of three parameters leaves the reader guessing about the third, for the same reason the block rule admits no exceptions — a partial list cannot be told apart from an oversight.
It is also where the editor looks: typing a call surfaces the active parameter's `@param` text and nothing else, so an untagged parameter leaves an empty prose slot at exactly the moment someone wants it filled.

**The judgement is in what a tag says, never in whether it is there.**

### Write a tag that says something

Mandatory is not a licence for empty.
Where a constraint exists that the type cannot express, that is what the tag is for.
Where the name and type already carry the meaning, keep it to a short phrase and move on.

```ts
/** Title or description contains the needle.
 *
 * @param task Task to test.
 * @param needle Must already be normalised by `normaliseQuery`.
 * @returns Whether either field contains the needle.
 */
export function matchesQuery(task: TaskDTO, needle: string): boolean {
  // ...
}
```

`@param needle` is the line doing real work: the type permits any string, and only this says which strings are valid.
`@param task` earns its place by completing the list rather than by what it says, and that trade is deliberate.

Reach for the constraint over the restatement wherever one exists — a unit, a range, an ownership rule, a caller's obligation, a precondition.
Those are the lines a reader cannot reconstruct from the signature.

### Keep tag names in step with the signature

A `@param` names the parameter it documents, so renaming a parameter means renaming its tag.
This is the most common way a block rots: the signature change is obvious in review and the stale tag beside it is not.

### `@throws` wherever a function throws

No signature in TypeScript expresses what a function throws, so this tag is never a restatement, and a caller who does not know cannot find out without reading the body.

It is also the tag nothing reliably checks.
Whether it is there, and whether it is right, is on the person writing it.

```ts
/** Get a specific Task, given an ID.
 *
 * @param id Id of the task to return.
 * @returns The task, as a DTO.
 * @throws NotFoundError when no task has that id.
 */
export async function getTaskById(id: string): Promise<TaskDTO> {
  // ...
}
```

### A destructured parameter is documented by its type

A parameter written as a destructuring pattern has no name to put in a `@param`.
Listing its properties one at a time restates the type it already has, and the type is where those members are documented — they carry blocks of their own.

So a function taking one destructured argument documents its summary and its return, and leaves the argument to its type:

```ts
/** Everything the task list narrows by, in one value. */
export interface TaskNarrowing {
  /** Already normalised. Empty means "no query", never "match nothing". */
  needle: string;
  /** Selected category ids, where `null` is the Uncategorised option. */
  categoryIds: ReadonlySet<string | null>;
}

/** Whether any control is currently narrowing the list.
 *
 * @returns True when a query or a category selection is in force.
 */
export function isNarrowing({ needle, categoryIds }: TaskNarrowing): boolean {
  // ...
}
```

**A React component is the commonest case rather than a special one.**
Its single parameter is a props object, so it takes no `@param`, and it takes no `@returns` either — every component returns markup, and saying so documents the framework rather than the component.
Give it a summary and prose; its props type carries the rest.

```tsx
/** The row of controls above the task list.
 *
 * Wrapping rather than a breakpoint: the field claims the row and the controls
 * drop below it once they no longer fit, so the layout follows how many
 * controls there are rather than a guess about screen width.
 */
export function TasksToolbar({ query, onQueryChange }: TasksToolbarProps) {
  // ...
}
```

## Comments are evergreen

A comment must read as true whenever someone opens the file, with no other context to hand.

That rules out:

- **Issue and pull request numbers.**
  A comment needing the tracker open to be understood stops working the moment someone reads the file on its own.
- **Version numbers and release names.**
  These date the comment without explaining the code.
- **Anything about what the code will become.**
  "Stands in until the category control lands" is wrong the day that control lands, and nothing prompts anyone to revisit it.
- **Anything about what the code used to be.**
  Git records that, records it accurately, and goes on recording it long after the comment has drifted.

### Rationale survives; history does not

The distinction matters more than it sounds, because the comments most worth keeping are the ones that look most like history.

**Keep** — why the code is shaped this way.
Without it the line reads as boilerplate and gets deleted:

```tsx
// Radix closes the menu when an item is selected, which is right for an action
// and wrong for a multi-select: without this the menu shuts on every toggle.
onSelect={(event) => event.preventDefault()}
```

**Drop** — what happened.
True when written, unverifiable later, and already recorded in the commit that introduced it:

```tsx
// Added to fix the bug where the menu closed after each pick.
onSelect={(event) => event.preventDefault()}
```

The test: **will this still be true, and still be useful, in a year, to someone who never saw the change?**
The first survives it. The second does not.
