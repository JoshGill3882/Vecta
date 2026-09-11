# UI & frontend

How the frontend is put together: the component toolkit, where components live,
how to add a page, and how theming works. Task-oriented — for the overall
feature roadmap see [`docs/PLAN.md`](../PLAN.md).

## Toolkit

- **[shadcn/ui](https://ui.shadcn.com/)** (radix base, `radix-nova` style) — we
  own the component source; it lives in `src/components/ui`. Config is in
  [`components.json`](../../components.json); its aliases point at `src/`.
- **[Tailwind CSS v4](https://tailwindcss.com/)** — configured in CSS
  (`app/globals.css`), no `tailwind.config.js`.
- **[lucide-react](https://lucide.dev/)** for icons.
- **[`sonner`](https://ui.shadcn.com/docs/components/sonner)** for toasts (the
  replacement for shadcn's deprecated `toast`).
- `cn()` in `src/lib/utils.ts` merges class names (`clsx` + `tailwind-merge`);
  every component uses it.

## Where components live

One rule decides the folder:

| Component is…                             | Lives in…                                | Example                            |
| ----------------------------------------- | ---------------------------------------- | ---------------------------------- |
| A reusable primitive (shadcn or your own) | `src/components/ui/`                     | `button.tsx`, `dialog.tsx`         |
| Shared across **more than one route**     | `src/components/<area>/`                 | `src/components/shell/top-bar.tsx` |
| Owned by **one route** (a page's view)    | co-located in `app/…` next to `page.tsx` | `app/(app)/tasks-view.tsx`         |

In short: **shared → `src/components/`; one-off page code → a view file beside
its route.** This mirrors how the login route is laid out — `page.tsx`,
`login-form.tsx`, and `actions.tsx` sitting together — and the
[server-action co-location](./server-actions.md) decision.

## The app shell

Authenticated pages render inside the `(app)` [route
group](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)
so the shell wraps them but not `/login`. The group's layout
(`app/(app)/layout.tsx`) renders the top bar, the main content region, and the
global toaster:

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

The top bar (`src/components/shell/top-bar.tsx`) is a Server Component. Its
logout is a plain `<form action={logoutAction}>` — no client JS needed. The
Tasks/Categories tabs (`src/components/shell/nav-tabs.tsx`) are the one client
island in the shell: they read `usePathname()` to highlight the active route,
and collapse to a segmented row on narrow viewports.

## How to add a page

1. Create the route: `app/(app)/<route>/page.tsx`. Keep it thin — auth-gate and
   render the view:

   ```tsx
   import { requireSession } from "@/src/lib/session";
   import { WidgetsView } from "./widgets-view";

   export default async function WidgetsPage() {
     await requireSession(); // redirects to /login if signed out
     return <WidgetsView />;
   }
   ```

2. Put the markup in a co-located view file (`app/(app)/<route>/widgets-view.tsx`).
   Keep it a Server Component; push only interactive bits into `"use client"`
   children beside it.
3. If it needs a nav tab, add an entry to the `TABS` array in
   `src/components/shell/nav-tabs.tsx`.
4. Server actions for the route go in a co-located `actions.tsx` — see the
   [Server Actions guide](./server-actions.md).

## Theming

The app is **dark-only**. `app/layout.tsx` forces `class="dark"` on `<html>`,
and the palette lives in the `.dark` block of `app/globals.css`. It maps the
design's colours onto shadcn's semantic tokens (`--background`, `--primary`,
`--border`, `--ring`, …) plus a few extras (`--surface-2`, `--text-3`,
`--brand-orange`, the status colours) exposed as Tailwind utilities via the
`@theme inline` block.

- **To recolour something**, edit the value in the `.dark` block — every
  component that uses the corresponding token updates.
- Prefer semantic utilities (`bg-primary`, `text-muted-foreground`,
  `border-border`) over raw colours so components stay theme-consistent.
- The `:root` block holds shadcn's light-mode baseline; it's dormant (nothing
  toggles it) but kept so a light theme could be added later without re-deriving
  the token set.

## Toasts

`<Toaster/>` is mounted once in the `(app)` layout. Fire a toast from any client
component:

```tsx
import { toast } from "sonner";

toast.success("Task created");
toast.error("Something went wrong");
```

## Forms

shadcn's `form` component wraps
[react-hook-form](https://react-hook-form.com/). Pair it with the Zod schemas
from the [validation guide](./validation.md) so the client mirrors the same
rules the server enforces — one schema, both sides.

## Confirmations & destructive actions

Every destructive action gets a confirmation step (a project rule — see
[`docs/PLAN.md`](../PLAN.md)). Use the shadcn **`AlertDialog`** primitive, not
`Dialog`: it's the modal-confirm variant, and it can't be dismissed by clicking
the overlay. Name the thing being destroyed in the description so the prompt is
unambiguous. The task delete flow (`app/(app)/tasks/delete-task-dialog.tsx`) is
the reference; the categories delete reuses the same shape.

Three things are easy to get wrong:

- **Trigger and dialog are separate Radix layers.** When the confirm is opened
  from a `DropdownMenu` item, keep the `AlertDialog` a **sibling** of the menu,
  not nested inside a menu item — both trap focus, so the menu must close before
  the dialog opens or they fight over it. Drive the dialog from state the menu
  sets (`onSelect={() => setConfirmOpen(true)}`).
- **Let the confirm callback own the close.** Give the dialog an
  `onConfirm: () => Promise<boolean>` that resolves `true` only when the action
  succeeded — the same contract the [form dialog](#forms) uses for save. A
  failure then keeps the dialog open over the item the user was trying to remove
  rather than dismissing as though it worked; the caller surfaces the error as a
  [toast](#toasts).
- **Stop `AlertDialogAction` auto-closing when the work is async.** It closes on
  click by default, which tears the dialog down before an `await` resolves.
  `preventDefault()` in its `onClick` and close via the `onConfirm` result
  instead; disable both buttons while the action is in flight.

## Dialog focus

Every dialog here is **controlled** — opened from an `open` prop, with no
`DialogTrigger`. Radix's modal close behaviour restores focus to that trigger;
with no trigger the restore is a no-op and focus falls to `<body>`, stranding a
keyboard or screen-reader user at the top of the page. The shared `DialogContent`
and `AlertDialogContent` wrappers close this gap with `useRestoreFocus`
(`src/components/ui/use-restore-focus.ts`): it records the element that had focus
when the dialog opened and returns focus to it on close, however the dialog is
dismissed (Esc, the close button, Cancel, the overlay). This is automatic — a new
dialog inherits it with no per-dialog wiring. To opt a dialog out (custom close
focus), pass your own `onCloseAutoFocus` and call `preventDefault()`.

The one case the shared restore can't cover is **a close that removes its own
opener** — a successful delete unmounts the card or row whose control opened the
confirm dialog. Returning focus to a node that is about to vanish just lands on
`<body>` a moment later, and because `router.refresh()` is async the opener is
often still mounted at close time, so the restore can't detect it. Handle this in
the view that _survives_ the delete, not in the dialog:

- Record the intent in a **ref** (not state — a render here would race the
  refresh), then move focus in an effect keyed on the refreshed data, so it runs
  after the list re-renders without the deleted item.
- Aim focus at a **stable landmark**: the task's status-section header
  (`taskSectionHeaderId(status)` in `task-section.tsx`) for a task delete, the
  page heading for a category delete. A non-interactive landmark like the heading
  needs `tabIndex={-1}` to be focusable.

`tasks-view.tsx` and `categories-view.tsx` are the reference implementations.
