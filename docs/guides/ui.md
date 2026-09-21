# UI & frontend

How the frontend is put together:
the component toolkit, where components live, how to add a page, and how theming works.
Task-oriented — for the overall feature roadmap see [`docs/PLAN.md`](../PLAN.md).

## Toolkit

- **[shadcn/ui](https://ui.shadcn.com/)** (radix base, `radix-nova` style) — we own the component source;
  it lives in `src/shared/components/ui`.
  Config is in [`components.json`](../../components.json); its aliases point at `src/`.
- **[Tailwind CSS v4](https://tailwindcss.com/)** — configured in CSS (`app/globals.css`), no `tailwind.config.js`.
- **[lucide-react](https://lucide.dev/)** for icons.
- **[`sonner`](https://ui.shadcn.com/docs/components/sonner)** for toasts (the replacement for shadcn's deprecated `toast`).
- `cn()` in `src/shared/lib/utils.ts` merges class names (`clsx` + `tailwind-merge`); every component uses it.

## Where components live

[Directory structure](../../ARCHITECTURE.md#directory-structure) in the architecture document is the
single description of the layout — for components and for everything else.

This guide deliberately does not repeat it.
Two copies of the rule is how the previous one came to cite, as its example of a component shared
across routes, a component with exactly one consumer.

## The app shell

Authenticated pages render inside the `(app)` [route group](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) so the shell wraps them but not `/login`.
The group's layout (`app/(app)/layout.tsx`) renders the top bar, the main content region, and the global toaster:

```text
app/(app)/
  layout.tsx            top bar + <main> + <Toaster/>
  page.tsx              Tasks route (/)   — thin: requireSession() → <TasksView/>
  tasks-view.tsx        the Tasks view
  actions.tsx           task server actions
  categories/
    page.tsx            Categories route (/categories)
    categories-view.tsx
    actions.tsx
```

The top bar (`src/shared/components/shell/top-bar.tsx`) is a Server Component.
Its logout is a plain `<form action={logoutAction}>` — no client JS needed.
The Tasks/Categories tabs (`src/shared/components/shell/nav-tabs.tsx`) are the one client island in the shell:
they read `usePathname()` to highlight the active route, and collapse to a segmented row on narrow viewports.

## How to add a page

1. Create the route: `app/(app)/<route>/page.tsx`.
   Keep it thin — auth-gate and render the view:

   ```tsx
   import { requireSession } from "@/src/shared/lib/session";
   import { WidgetsView } from "./widgets-view";

   export default async function WidgetsPage() {
     await requireSession(); // redirects to /login if signed out
     return <WidgetsView />;
   }
   ```

2. Put the markup in a co-located view file (`app/(app)/<route>/widgets-view.tsx`).
   Keep it a Server Component; push only interactive bits into `"use client"` children beside it.
3. If it needs a nav tab, add an entry to the `TABS` array in `src/shared/components/shell/nav-tabs.tsx`.
4. Server actions for the route go in a co-located `actions.tsx` — see the [Server Actions guide](./server-actions.md).

## Theming

The app is **dark-only**.
`app/layout.tsx` forces `class="dark"` on `<html>`, and the palette lives in the `.dark` block of `app/globals.css`.
It maps the design's colours onto shadcn's semantic tokens (`--background`, `--primary`, `--border`, `--ring`, …) plus a few extras (`--surface-2`, `--text-3`, `--brand-orange`, the status colours) exposed as Tailwind utilities via the `@theme inline` block.

- **To recolour something**, edit the value in the `.dark` block — every component that uses the corresponding token updates.
- Prefer semantic utilities (`bg-primary`, `text-muted-foreground`, `border-border`) over raw colours so components stay theme-consistent.
- The `:root` block holds shadcn's light-mode baseline;
  it's dormant (nothing toggles it) but kept so a light theme could be added later without re-deriving the token set.

## Toasts

`<Toaster/>` is mounted once in the `(app)` layout.
Fire a toast from any client component:

```tsx
import { toast } from "sonner";

toast.success("Task created");
toast.error("Something went wrong");
```

## Forms

shadcn's `form` component wraps [react-hook-form](https://react-hook-form.com/).
Pair it with the Zod schemas from the [validation guide](./validation.md) so the client mirrors the same rules the server enforces — one schema, both sides.

## Confirmations & destructive actions

Every destructive action gets a confirmation step (a project rule — see [`docs/PLAN.md`](../PLAN.md)).
Use the shadcn **`AlertDialog`** primitive, not `Dialog`:
it's the modal-confirm variant, and it can't be dismissed by clicking the overlay.
Name the thing being destroyed in the description so the prompt is unambiguous.
The task delete flow (`src/features/tasks/components/list/delete-task-dialog.tsx`) is the reference;
the categories delete reuses the same shape.

Three things are easy to get wrong:

- **Trigger and dialog are separate Radix layers.** When the confirm is opened from a `DropdownMenu` item, keep the `AlertDialog` a **sibling** of the menu, not nested inside a menu item — both trap focus, so the menu must close before the dialog opens or they fight over it.
  Drive the dialog from state the menu sets (`onSelect={() => setConfirmOpen(true)}`).
- **Let the confirm callback own the close.** Give the dialog an `onConfirm: () => Promise<boolean>` that resolves `true` only when the action succeeded — the same contract the [form dialog](#forms) uses for save.
  A failure then keeps the dialog open over the item the user was trying to remove rather than dismissing as though it worked;
  the caller surfaces the error as a [toast](#toasts).
- **Stop `AlertDialogAction` auto-closing when the work is async.** It closes on click by default, which tears the dialog down before an `await` resolves.
  `preventDefault()` in its `onClick` and close via the `onConfirm` result instead;
  disable both buttons while the action is in flight.

## Dialog focus

Every dialog here is **controlled** — opened from an `open` prop, with no `DialogTrigger`.
Radix's modal close behaviour restores focus to that trigger;
with no trigger the restore is a no-op and focus falls to `<body>`, stranding a keyboard or screen-reader user at the top of the page.
The shared `DialogContent` and `AlertDialogContent` wrappers close this gap with `useRestoreFocus` (`src/shared/components/ui/use-restore-focus.ts`):
it records the element that had focus when the dialog opened and returns focus to it on close, however the dialog is dismissed (Esc, the close button, Cancel, the overlay).
This is automatic — a new dialog inherits it with no per-dialog wiring.
To opt a dialog out (custom close focus), pass your own `onCloseAutoFocus` and call `preventDefault()`.

The one case the shared restore can't cover is **a close that removes its own opener** — a successful delete unmounts the card or row whose control opened the confirm dialog.
Returning focus to a node that is about to vanish just lands on `<body>` a moment later, and because `router.refresh()` is async the opener is often still mounted at close time, so the restore can't detect it.
Handle this in the view that _survives_ the delete, not in the dialog:

- Record the intent in a **ref** (not state — a render here would race the refresh), then move focus in an effect keyed on the refreshed data, so it runs after the list re-renders without the deleted item.
- Aim focus at a **stable landmark**:
  the task's status-section header (`taskSectionHeaderId(status)` in `task-section.tsx`) for a task delete, the page heading for a category delete.
  A non-interactive landmark like the heading needs `tabIndex={-1}` to be focusable.
- **Have a fallback for a landmark that may not exist.**
  A landmark can vanish in the same delete that needs it: the status section holding the last match is dropped while the list is narrowed, and the empty state that would otherwise stand in is not rendered while other sections still show results.
  `tasks-view.tsx` resolves the first of three ids actually in the DOM — section header, then empty-state heading, then the search field — rather than assuming the first one is there.

`tasks-view.tsx` and `categories-view.tsx` are the reference implementations.

## Narrowing the task list

The task list is narrowed **in the browser, never on the server**.
`app/(app)/tasks/page.tsx` already fetches every task and hands the array to `TasksView` as props, so filtering it costs no round trip, no service function and no URL state.
The trigger for revisiting that is the payload of fetching every task becoming a problem — not filtering feeling slow.

**The matching logic lives in `src/features/tasks/lib/task-search.ts`, not in the view.**
It is a pure module over `TaskDTO[]` — no state, no DOM, no clock.
That is deliberate: there is no component renderer in the test setup (see the [testing guide](./testing.md)), so logic left inside a component is logic that cannot be tested.
Anything with an edge case worth pinning down belongs in that module; the component keeps the wiring only.

Several things here are easy to get wrong.

- **A narrowing control reads the stored collapsed state and never writes it.**
  A match hidden inside a collapsed section reads as no match, so sections are forced open while the list is narrowed.
  Writing that through the stored preference would destroy something the user set for an unrelated reason.
  `useSectionCollapse` holds the transient override instead, and discards it when the narrowing ends, so clearing a query restores what the user left.
- **Collapse handlers take the new value; they do not flip the old one.**
  `useCollapsedSections` exposes `setCollapsed(status, collapsed)` and `TaskSection` passes Radix’s reported state through.
  A handler that flips assumes the rendered and stored values always agree, which stops being true the moment a section is forced open.
- **The narrowed count is announced, not just displayed.**
  The header subtitle carries `role="status"` — an [ARIA live region](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions) — so a screen-reader user hears the list narrow instead of the number changing silently.
  Keep that element mounted with only its text changing: a live region added to the page at the same moment as its content is often missed entirely.
  `status` is polite, so fast typing coalesces into one announcement rather than one per keystroke.
- **Match highlighting uses `indexOf`, not a `RegExp`.**
  The query is user input, so a pattern built from it would need every metacharacter escaped before it could be trusted — a search for `.*` must highlight those two characters rather than the whole title, and an unclosed `[` must not throw.
  `findMatches` returns index pairs into the original string, which also keeps the title's own casing in the output.
- **A global key shortcut must not fire mid-typing.**
  `/` focuses the search field, so the handler ignores the key when the event's target is already a field (`input`, `textarea`, `select`, `[contenteditable]`), when a modifier is held, and when `isComposing` is set — an IME composing a character emits keystrokes that are input, not commands.
- **Every narrowing control answers to one predicate.**
  `isNarrowing` in `src/features/tasks/lib/task-search.ts` is what the rules key off - sections forced open, empty sections dropped, the subtitle switching to "n of m".
  None of those rules is about search, so none of them should test a query directly.
  A control that narrows the list adds a criterion to `TaskNarrowing` and the rules follow; a control that tests its own state is a control the other rules do not know about.
  Uncategorised is `null` in the selected set rather than a sentinel string, because `TaskDTO.categoryId` is already `string | null` and a set holding `null` matches an uncategorised task directly.
- **The no-results state names and clears whatever is actually narrowing.**
  A message blaming a search when a filter emptied the list is wrong, and a button that clears one control leaves a list that still looks broken.
  Both are derived from which controls are active, so adding a control means extending that description rather than leaving it describing the one case it was written for.
- **The transient collapse resets during render, not in an effect.**
  `react-hooks/set-state-in-effect` is an error here, so the reset compares the previous narrowing state to the current one in the component body and clears the map on the transition.
  React applies that before the sections render, so they never see a map left from the last time the list was narrowed.
  It looks like something that belongs in an effect; moving it there fails lint.
- **An empty section means different things while browsing and while narrowing.**
  With nothing narrowing the list, a status holding no tasks keeps its header — `In Progress 0` describes the state of your work — but renders no chevron and no body, because a section with no tasks has nothing to collapse (`task-section.tsx`).
  While narrowing, that same section is dropped entirely: zero matches in a status says something about the query, not about what the status contains.
  Neither form touches the stored collapsed state, so a section that empties and refills returns to where the user left it.

Do **not** debounce the input.
Filtering an array already in memory is sub-millisecond; a debounce would only add latency the user can feel.

## Remembering a preference

A preference that survives a reload goes through `createPersistedValue` in
[`src/shared/hooks/use-persisted-value.ts`](../../src/shared/hooks/use-persisted-value.ts).
It takes a cookie name, a parser and a fallback, and hands back a hook.
Both the collapsed sections and the sort order are built from it, and the next one should be too — not because the duplication is long, but because most of its parts are subtle and none of them fails loudly:

- **A cookie, because the server renders these preferences.**
  A cookie arrives with the request, so the first paint is already correct.
  Storage the server cannot reach would leave the page painting a default and correcting itself once hydration finished, which reorders the whole list in front of the reader.
- **The parser is shared with the server.**
  It lives beside the data in `lib/`, not in the hook, because a `"use client"` module cannot be called from a Server Component.
  One definition means the two ends cannot disagree about what a stored value means.
- **The store is module scope, not per hook instance.**
  A preference is one value however many components read it.
- **`getSnapshot` returns a cached reference.**
  `useSyncExternalStore` compares snapshots by identity, so parsing the cookie afresh on every call is an infinite render loop rather than a slow render.
- **`getServerSnapshot` returns what the server rendered with**, threaded down as a prop from the route.
  It has to match the first client render exactly, and it does, because both read the same cookie.
- **The parser treats what it reads as untrusted.**
  A stored value survives deploys and is editable by anyone with the console open, so it can name an option a later version removed. Anything the parser rejects falls back.

**Cross-tab changes travel over a `BroadcastChannel`.**
A cookie fires no event of its own, so one tab tells the others to re-read.
Where the API is missing the preference still works and still persists; only live following of a change made in another tab goes.
That trade is the one worth naming: a flash on every reload against live cross-tab sync, and the channel is what buys both rather than either.

**`localStorage` is still the right answer for some preferences**, and this is not a precedent against it.
Reach for it when the server never renders the value, when it should not be sent with every request, or when it is larger than a cookie should carry.

Cookies are prefixed `vecta_`, scoped to `path=/`, set `SameSite=Lax`, and marked `Secure` only when the page is served over HTTPS — this is self-hosted, and an install on a plain-HTTP LAN would find a `Secure` cookie silently never sent back.
Nothing migrates a renamed cookie: a preference reverting to its default once is judged cheaper than carrying migration code for it.

**Sorting is not narrowing, and runs after it.**
The order applies within each status bucket, so sections keep their fixed order while their contents reorder.
The comparators live in [`src/features/tasks/lib/task-sort.ts`](../../src/features/tasks/lib/task-sort.ts) and compare titles with `localeCompare` against an explicit locale — a plain `<` puts every capital before every lowercase letter, and leaving the locale to the runtime lets the server and the client disagree about collation, which is a hydration mismatch in the markup rather than in any stored value.
