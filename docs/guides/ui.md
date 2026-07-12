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

```
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
