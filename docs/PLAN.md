# Task Manager — Project Plan

> **Studio MVP** · Self-hosted, open-source, single-user task management

---

## 1. Project Overview

A self-hosted, open-source task management web application built on Next.js, intended as the Studio's proof-of-concept project. The MVP is deliberately scoped tight — a clean, well-engineered slice of functionality — with a clear roadmap of stretch goals for after launch.

**Audience:** technical self-hosters running a single-user instance, deployed via Docker.

**Quality bar:** "industry-standard" — meaning sensible CI/CD, tests on the things that matter, written documentation, and a clean architecture that won't embarrass us when someone reads the code.

---

## 2. Confirmed Stack & Architectural Decisions

The following decisions were made up-front and should not be re-litigated mid-build without a deliberate change discussion:

| Concern                | Decision                                                                                                                           | Why                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Next.js (App Router) + TypeScript + Tailwind                                                                                       | Already initialised; modern default; good for back-end devs leaning into full-stack                                          |
| **UI components**      | [shadcn/ui](https://ui.shadcn.com/)                                                                                                | Tailwind-native; we own the source; built on Radix for accessibility; avoids the "back-end dev built a UI" look              |
| **ORM**                | [Prisma](https://www.prisma.io/)                                                                                                   | Mature DX; Prisma Studio for visual debugging; schema-in-one-file; pairs cleanly with both SQLite and Postgres               |
| **Database (default)** | SQLite, file in mounted                                                                                                            | One container; trivial backup; sufficient for single-user                                                                    |
| **Database (opt-in)**  | Postgres via `DATABASE_URL` env                                                                                                    | For users who want it; same Prisma schema works for both                                                                     |
| **Auth**               | Single admin user; password via `ADMIN_PASSWORD` env var; session cookie via [iron-session](https://github.com/vvo/iron-session)   | Minimum viable; defends against accidental open-internet exposure; future-proofs for multi-user without committing to it now |
| **API style**          | Server Actions for mutations + Server Components for reads, **with all DB access behind a service layer** (`src/server/services/`) | Speed of Server Actions for MVP; clean seam for a future REST API; idiomatic Next.js in 2026                                 |
| **Validation**         | [Zod](https://zod.dev/) at every server-action and service-layer entry point                                                       | Run-time validation + TS types from one definition                                                                           |
| **Distribution**       | GitHub Container Registry; `:stable` from `production`, `:unstable` from `develop`                                                 | As specified in the brief                                                                                                    |
| **Licence**            | MIT (suggested — finalise before public launch)                                                                                    | Permissive; standard "no warranty" disclaimer covers liability concerns                                                      |

**Important constraint:** because we support both SQLite and Postgres, the Prisma schema must avoid Postgres-specific column types like `Json`/`Jsonb` and native UUID types. Stick to `String`, `Int`, `DateTime`, `Boolean`. Use `cuid()` or `uuid()` from Prisma for IDs (stored as strings).

---

## 3. MVP Scope

**In scope:**

- Tasks with: title, description (Markdown stored as text, rendered on display), category, status (`open` / `in_progress` / `closed`)
- Categories (flat — no sub-categories in MVP), each with an assignable colour
- Task list view, grouped by status, with collapsible sections
- Inline quick-add (type a title, press Enter) for fast task capture
- Task create / edit / delete
- Single-admin authentication
- Mobile-responsive layout (desktop-first, but usable on phone)
- Self-hosting via both `git clone` + `docker-compose` and pre-built GHCR image

**Out of scope (deferred to stretch):**

- Sub-categories / nested categories
- Task dependencies
- Acceptance criteria (toggleable)
- "Blocked" status
- Due dates and overdue indicators
- Search / filter / sort beyond status grouping
- Drag-and-drop kanban view
- Multi-user accounts, teams/orgs, sharing
- Email notifications
- Rich Markdown editor with preview toolbar (MVP uses a plain textarea + render-on-save)

---

## 4. Timeline

Based on a combined capacity of **~20 developer-hours per week** (2 × 10hrs), the MVP is estimated at **7–9 calendar weeks**. This assumes:

- Weeks where one dev has more time available average out
- ~10–15% slack built in for unknowns (always more than you expect)
- Phases overlap where possible to allow parallel work

| Phase     | Description                                   | Est. effort  | Calendar weeks                 |
| --------- | --------------------------------------------- | ------------ | ------------------------------ |
| 0         | Foundations: repo, CI, tooling                | ~15 hrs      | Week 1                         |
| 1         | Data layer: Prisma, schema, services skeleton | ~15 hrs      | Week 2 (parallel with Phase 2) |
| 2         | Authentication                                | ~15 hrs      | Week 2 (parallel with Phase 1) |
| 3         | Backend: services, server actions, validation | ~25 hrs      | Weeks 3–4                      |
| 4         | Frontend: shadcn, list view, forms            | ~40 hrs      | Weeks 4–6                      |
| 5         | Polish, accessibility, docs                   | ~15 hrs      | Week 7                         |
| 6         | Packaging: Dockerfile, compose, GHCR pipeline | ~20 hrs      | Week 8                         |
| **Total** |                                               | **~145 hrs** | **~8 weeks**                   |

A buffer week (Week 9) is recommended before declaring v1.0.0 — for inevitable last-minute fixes and a final manual QA pass on a freshly deployed instance.

---

## 5. Phase 0 — Foundations

> **Goal:** establish a workspace both developers can collaborate in without stepping on each other.

**Effort:** ~15 hrs · **Calendar:** Week 1 · **Should be done together where possible.**

### Tasks

- [x] Repository structure decided and documented in `README.md`
- [x] Branching strategy: `production` (stable releases), `develop` (integration), feature branches off `develop`
- [x] Branch protection rules on `production` and `develop` (require PR, require passing CI, no direct push)
- [x] Issue templates in `.github/ISSUE_TEMPLATE/` (feature, bug)
- [x] Pull request template in `.github/PULL_REQUEST_TEMPLATE.md`
- [x] ESLint + Prettier configured and CI-enforced
- [x] [Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) for pre-commit linting (catches style issues before they hit CI)
- [x] TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- [x] CI pipeline: GitHub Actions runs lint + typecheck + tests on every PR
- [x] `CONTRIBUTING.md` covering local setup steps, branching, commit conventions
- [x] `LICENSE` file (MIT)
- [x] `.env.example` committed; real `.env` gitignored

### Definition of Done

- Both devs can clone, install, and run the dev server in under 5 minutes following the README
- A trivial PR (e.g. add a one-line README change) passes through the full CI pipeline successfully
- Branch protection prevents direct push to `production` and `develop`

### References

- [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [GitHub Actions for Node.js](https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs)

---

## 6. Phase 1 — Data Layer

> **Goal:** Prisma installed, schema defined, migrations working, service layer scaffolded.

**Effort:** ~15 hrs · **Calendar:** Week 2 · **Can run in parallel with Phase 2.**

### Tasks

- [x] Install Prisma and `@prisma/client`
- [x] Configure dual-provider setup: SQLite by default, switchable to Postgres via `DATABASE_URL`
- [x] Define `schema.prisma` with the following models (initial cut):

```prisma
model Task {
  id          String   @id @default(cuid())
  title       String
  description String   @default("")
  status      String   // "open" | "in_progress" | "closed" — enum-as-string for SQLite compat
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Category {
  id        String @id @default(cuid())
  name      String   @unique
  color     String   @default("#6366f1") // hex colour for the category dot / badge
  tasks     Task[]
  createdAt DateTime @default(now())
}
```

- [x] First migration generated and applied (`prisma migrate dev`)
- [x] Service layer scaffolding under `src/server/services/`:
  - `tasks.ts` — `getTasks()`, `getTaskById()`, `createTask()`, `updateTask()`, `deleteTask()`
  - `categories.ts` — equivalent functions
  - Stub implementations only at this stage; logic comes in Phase 3
- [x] Singleton Prisma client at `src/server/db.ts` (avoids connection storm in dev hot-reload)
- [x] Seed script at `prisma/seed.ts` for development data
- [x] Database file path configurable via env var (defaults to `./data/app.db` for SQLite)

### Definition of Done

- `npm prisma migrate dev` from a clean state succeeds and creates the schema
- `npm prisma studio` opens and shows the empty tables
- `npm db:seed` populates a few example tasks and categories
- Switching `DATABASE_URL` from SQLite to a local Postgres instance and re-running migrations succeeds
- Service layer functions exist and have correct TypeScript signatures (even if bodies just `throw new Error("not implemented")`)

### References

- [Prisma getting started — TypeScript + SQLite](https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/relational-databases-typescript-sqlite)
- [Prisma + PostgreSQL connection URLs](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Prisma in long-running processes (singleton pattern for Next.js)](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices)

---

## 7. Phase 2 — Authentication

> **Goal:** the app is unusable without logging in as the admin.

**Effort:** ~15 hrs · **Calendar:** Week 2 · **Can run in parallel with Phase 1.**

### Approach

Single admin user. Password is read from the `ADMIN_PASSWORD` env var on each login attempt. **No password storage in the database** — this keeps the model simple and means the only way to "reset" the password is to update the env var and restart the container, which is appropriate for a self-hosted single-user app.

Sessions are managed by [iron-session](https://github.com/vvo/iron-session) — encrypted, signed cookies stored client-side, no session table needed.

### Tasks

- [x] Install `iron-session`
- [x] Add required env vars to `.env.example`:
  - `ADMIN_PASSWORD` (required; app refuses to start if missing)
  - `SESSION_SECRET` (required; min 32 chars; document that users must generate their own)
- [x] Boot-time check: app exits with a clear error if either env var is missing or `SESSION_SECRET` is too short — see `instrumentation.ts` (`register()`)
- [x] `/login` page (server component) with a simple form — `app/login/page.tsx` + `app/login/login-form.tsx` (client island)
- [x] Login server action: timing-safe comparison of submitted password against `ADMIN_PASSWORD` (use `crypto.timingSafeEqual`), set session cookie on success — `app/login/actions.tsx`
- [x] Logout server action: clears the session — `app/logout/actions.tsx`
- [x] ~~Middleware (`src/middleware.ts`)~~ **Proxy (`proxy.ts`)** that redirects unauthenticated requests to `/login` for all routes except `/login` itself and static assets. Next.js 16 renamed Middleware → Proxy; this is an optimistic perimeter check only — each protected page still calls `requireSession()` as the real guard.
- [x] Auth helpers: `getSession()`, `requireSession()` for use in server components and actions — `src/lib/session.ts` (also `createSession()` / `destroySession()`)
- [x] Rate-limiting on the login action (in-memory bucket is fine for single-user; deters brute force) — `src/lib/rate-limit.ts`

### Definition of Done

- [x] Hitting any route while logged out redirects to `/login`
- [x] Submitting the correct password redirects to `/`, or back to the originally-requested path when there is one — the proxy appends `?next=<path>` on the bounce, the login form forwards it, and the action redirects there after validating it is a same-origin relative path (open-redirect guard in `safeRedirectTarget`)
- [x] Submitting the wrong password 5 times in 60 seconds is blocked — the login Server Action returns a user-facing `{ error: "Too many attempts…" }` message. (A form-action's return value is delivered as a `200` payload, not an HTTP status; emitting a real `429` would require moving the check into a Route Handler. The message is the intended behaviour here.)
- [x] Logout clears the cookie and redirects to `/login`
- [x] App refuses to boot with a missing `ADMIN_PASSWORD` or `SESSION_SECRET`, with a clear error message
- [x] The session secret is genuinely random — document this in the README and provide a snippet (`openssl rand -hex 32`)

### Tests

Auth is covered by Vitest unit tests under `test/` (which mirrors the source
tree); run them with `npm test`. Coverage spans the session helpers, the proxy
perimeter, the rate-limit window, and the login/logout actions. See the
[testing guide](./guides/testing.md) for the mocking patterns used — listing
individual files here only invites drift.

### References

- [iron-session docs (Next.js App Router examples)](https://github.com/vvo/iron-session#nextjs-app-router)
- [Next.js Proxy (formerly Middleware)](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [`crypto.timingSafeEqual` — Node.js docs](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)

---

## 8. Phase 3 — Backend: Services, Server Actions, Validation

> **Goal:** all task and category mutations work end-to-end on the server, with validation and error handling, before any UI work begins.

**Effort:** ~25 hrs · **Calendar:** Weeks 3–4

### Tasks

- [ ] Zod schemas for input validation in `src/lib/schemas/`:
  - `taskCreateSchema`, `taskUpdateSchema`
  - `categoryCreateSchema`, `categoryUpdateSchema`
- [ ] Service layer fully implemented:
  - All CRUD operations
  - Sensible error types (e.g. `NotFoundError`, `ValidationError`) — don't leak Prisma errors directly
  - All functions return DTOs, not raw Prisma models, so the shape is decoupled from the schema
- [ ] Server Actions in `src/app/actions/`:
  - Wrap each service call
  - Validate input with Zod before passing to service
  - Translate errors into a consistent return shape (`{ ok: true, data } | { ok: false, error }`)
  - Call `revalidatePath()` after mutations
- [ ] Unit tests for service layer (using [Vitest](https://vitest.dev/)) — mock Prisma; aim for ~80% coverage of services
- [ ] Integration tests for at least the critical paths: create task, update task, delete task — run against a real SQLite test DB

### Definition of Done

- All service functions have unit tests that pass
- A test SQLite database is created and torn down between integration test runs
- Calling a server action with invalid data returns a structured error (never throws to the client)
- No Prisma client is imported anywhere outside `src/server/`
- `npm test` runs cleanly in CI

### References

- [Next.js Server Actions](https://nextjs.org/docs/app/getting-started/updating-data)
- [Zod documentation](https://zod.dev/)
- [Vitest with Next.js](https://vitest.dev/guide/)
- [Prisma testing strategies](https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing)

---

## 9. Phase 4 — Frontend: List View, Forms, Polish

> **Goal:** the app is usable end-to-end via the UI.

> **Design:** the primary UI design is already complete (built in Claude Design). It defines the login screen, app shell (top bar + Tasks/Categories tabs), the task list with an inline quick-add bar and three collapsible status sections, task cards, the create/edit modal (segmented status control + category select), and the categories view with per-category colours. Build to match it. Design file: https://claude.ai/design/p/959c7f14-0ec7-4102-a374-1d60ad78582e?via=share

**Effort:** ~40 hrs · **Calendar:** Weeks 4–6 · **The biggest phase — protect time for it.**

This is the phase where back-end developers tend to underestimate. shadcn/ui mitigates that significantly but doesn't eliminate it.

### Tasks

- [ ] [shadcn/ui](https://ui.shadcn.com/docs/installation/next) initialised
- [ ] Install components as needed: `button`, `input`, `textarea`, `select`, `dialog`, `card`, `dropdown-menu`, `form`, `toast`, `collapsible`, `badge`
- [ ] Theme tokens reviewed and lightly customised (don't go down a design rabbit hole)
- [ ] Application shell:
  - Top bar with app title and logout button
  - Main content region
  - Mobile: hamburger menu pattern for any nav, but for MVP this is minimal
- [ ] Task list view (`/`):
  - Three collapsible sections: Open, In Progress, Closed
  - Each task shown as a card with title, category badge, truncated description preview
  - Click a task card (or its ⋮ overflow menu) to open the edit modal — the design uses a modal dialog, not a separate detail page
  - Empty state when no tasks exist
  - "New Task" button prominent
  - Inline quick-add bar at the top of the list: type a title and press Enter to create an Open task; supports a keyboard shortcut (`c`) to focus it (per the design)
- [ ] Task create form:
  - Modal dialog (confirmed by the design — same modal serves create and edit); supports keyboard shortcuts: `Esc` to cancel, `Cmd/Ctrl+Enter` to save
  - Fields: title (required), description (textarea), category (select with "+ create new" inline option), status (segmented 3-button control — Open / In Progress / Closed — per the design, defaults to Open)
  - Client-side validation mirrors the Zod schema
  - On submit, calls server action; toast on success or error
- [ ] Task edit form:
  - Same shape as create
  - Pre-populated; tracks dirty state to enable/disable save
- [ ] Task delete: confirm dialog before destructive action
- [ ] Markdown rendering: use [`react-markdown`](https://github.com/remarkjs/react-markdown) with [`remark-gfm`](https://github.com/remarkjs/remark-gfm) for tables/strikethrough; sanitise with `rehype-sanitize` to be safe
- [ ] Category management page (`/categories`):
  - List, create, rename, delete — each category has a colour (shown as a coloured dot / badge throughout, set via a colour swatch in the create/edit form, per the design)
  - Deleting a category sets affected tasks' `categoryId` to `null` (already in schema as `onDelete: SetNull`) — show a confirmation that explains this
- [ ] Mobile responsive pass: test at 375px and 768px viewports
- [ ] Loading states (use [`<Suspense>` boundaries](https://react.dev/reference/react/Suspense) where appropriate)
- [ ] Error boundaries for graceful failure

### Definition of Done

- A user can create, view, edit, and delete tasks and categories entirely through the UI
- The list view groups tasks correctly and the collapsible sections persist their open/closed state across reloads (use `localStorage`)
- Markdown in descriptions renders correctly, including code blocks and links
- The app is usable on a 375px-wide viewport with no horizontal scroll
- All forms show inline validation errors
- All destructive actions have a confirmation step

### References

- [shadcn/ui — Next.js installation](https://ui.shadcn.com/docs/installation/next)
- [shadcn/ui — Form component](https://ui.shadcn.com/docs/components/form) (uses react-hook-form + Zod)
- [react-markdown](https://github.com/remarkjs/react-markdown)
- [Tailwind responsive design](https://tailwindcss.com/docs/responsive-design)

---

## 10. Phase 5 — Polish & Documentation

> **Goal:** the app feels finished, and someone unfamiliar with the project can deploy it.

**Effort:** ~15 hrs · **Calendar:** Week 7

### Tasks

- [ ] Accessibility pass: keyboard navigation works on all interactive elements; focus rings visible; semantic HTML (use [Lighthouse](https://developer.chrome.com/docs/lighthouse/) and [axe DevTools](https://www.deque.com/axe/devtools/) as a baseline check)
- [ ] Empty / error / loading states audited across the app
- [ ] Toast feedback on every server action
- [ ] Favicon and basic OG metadata (title, description)
- [ ] `README.md` rewrite covering:
  - What the project is, what it isn't
  - Screenshots
  - Quick-start: pre-built image
  - Quick-start: docker-compose with cloned repo
  - Configuration reference (every env var documented in a table)
  - Backup & restore guidance (just "back up the volume" for SQLite; documented Postgres dump for Postgres users)
  - Upgrade path between versions
- [ ] `ARCHITECTURE.md` covering:
  - Directory structure
  - Server Actions + service layer pattern (and why)
  - Auth model
  - Database schema diagram (use [Mermaid](https://mermaid.js.org/) — renders natively on GitHub)
- [ ] `CHANGELOG.md` started (Keep a Changelog format)
- [ ] Tagged release `v0.1.0-rc1` from `develop`

### Definition of Done

- A developer who has never seen the project can clone it and have it running locally in under 10 minutes following the README
- Lighthouse score on the list view: ≥90 accessibility, ≥90 best practices

### References

- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Mermaid diagrams in GitHub Markdown](https://github.blog/developer-skills/github/include-diagrams-markdown-files-mermaid/)
- [WCAG 2.1 quick reference](https://www.w3.org/WAI/WCAG21/quickref/)

---

## 11. Phase 6 — Packaging & Deployment

> **Goal:** users can self-host either path documented in the brief.

**Effort:** ~20 hrs · **Calendar:** Week 8

### Tasks

- [ ] **Dockerfile** — multi-stage build using Next.js `output: "standalone"` mode; final image based on `node:lts-alpine` for small size
- [ ] [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output#automatically-copying-traced-files) configured in `next.config.js`
- [ ] Migrations run on container start (entrypoint script that runs `prisma migrate deploy` then starts the server)
- [ ] Data directory mounted as a volume; SQLite file lives there
- [ ] Healthcheck endpoint at `/api/health` (returns 200 with a small JSON; used by Docker `HEALTHCHECK` and reverse proxies)
- [ ] **`docker-compose.yml`** — committed to repo:
  - The app service using the locally-built image
  - Volume for data directory
  - Optional, commented-out Postgres service users can opt into
  - All env vars referenced from `.env`
- [ ] **`docker-compose.prod.yml`** — uses the GHCR image instead of building locally
- [ ] **GitHub Actions workflow** for image publishing:
  - On push to `develop`: build and tag as `:unstable`, `:develop-<sha>`
  - On push to `production`: build and tag as `:stable`, `:latest`, and the version from `package.json`
  - Multi-arch builds: `linux/amd64` and `linux/arm64` (Raspberry Pi self-hosters will appreciate this)
  - Push to `ghcr.io/<org>/<repo>`
- [ ] [Docker image signing with cosign](https://docs.github.com/en/actions/use-cases-and-examples/publishing-packages/publishing-docker-images) — optional but a "industry-standard" nice-to-have
- [ ] Image labels per [OCI annotations spec](https://github.com/opencontainers/image-spec/blob/main/annotations.md): `org.opencontainers.image.source`, `revision`, `version` etc. — populates the GHCR sidebar nicely
- [ ] Manual end-to-end verification:
  - Pull `ghcr.io/<org>/<repo>:stable` on a clean machine, run with the documented compose, confirm it works
  - Repeat for the cloned-repo path

### Definition of Done

- `docker compose up -d` from a fresh clone results in a working app reachable on the configured port
- `docker run` against the published image works the same way
- Both `:stable` and `:unstable` tags exist on GHCR and were built by the pipeline (not manually)
- The image is under ~250MB compressed (sanity check on bloat)
- Deploying a fresh instance and immediately upgrading to the next published version preserves all data

### References

- [Next.js — Deploying with Docker](https://nextjs.org/docs/app/getting-started/deploying#docker)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Publishing Docker images to GHCR via Actions](https://docs.github.com/en/actions/use-cases-and-examples/publishing-packages/publishing-docker-images)
- [`docker/build-push-action`](https://github.com/docker/build-push-action) — the standard action for multi-arch builds
- [Prisma — `migrate deploy` for production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/production-and-testing#deploy-migrations)

---

## 12. Cross-Cutting Concerns

These aren't tied to a single phase but should be kept in mind throughout.

### Testing strategy

For an MVP with limited time, prioritise tests where the cost of regression is highest:

- **Unit tests on the service layer** — high value, easy to write, catches the bulk of logic bugs
- **Integration tests on critical server actions** — create/update/delete tasks; auth login flow
- **Skip E2E for the MVP** — set up [Playwright](https://playwright.dev/) post-launch; add tests as you go

A single broken happy path in production is worse than 100 missing tests on edge cases. Cover the happy paths first.

### Logging & observability

- Use a structured logger ([pino](https://github.com/pinojs/pino) is the standard) from day one
- Log at server-action boundaries: input shape (no secrets), success/failure, duration
- Don't ship a metrics backend or tracing in MVP — but don't actively prevent adding them later

### Security baseline

- All env vars containing secrets gitignored and documented in `.env.example`
- HTTPS termination is the deployer's problem (reverse proxy) — document this clearly in the README rather than handling it in the app
- Set sensible `Content-Security-Policy` and other security headers via Next.js headers config
- Dependabot (or Renovate) enabled on the repo

### Code review discipline

With only two devs, every PR should still be reviewed. The review is the safety net the small team relies on. No solo merges to `develop` or `production`.

---

## 13. Risks & Mitigations

| Risk                                                                             | Likelihood | Impact | Mitigation                                                                                                   |
| -------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| **Frontend work expands beyond estimate**                                        | High       | High   | Hard-cap shadcn customisation; defer any "make it pretty" work to post-MVP. The default theme is fine for v1 |
| **One dev gets pulled into day-job crunch for several weeks**                    | Medium     | High   | Phases 1 and 2 deliberately parallelisable; later phases need both, so build a buffer week                   |
| **Scope creep — "while I'm in here" syndrome**                                   | High       | Medium | Anything not on the MVP list goes to a stretch-goals issue, not into the current branch                      |
| **SQLite/Postgres dual-support breaks one of them silently**                     | Medium     | High   | CI matrix runs the test suite against both providers                                                         |
| **Docker image works locally but fails on `arm64`**                              | Medium     | Medium | CI does multi-arch builds from the start, not as a v1.1 task                                                 |
| **Self-hoster exposes the app to the internet without setting `ADMIN_PASSWORD`** | Medium     | High   | Boot-time check that refuses to start without it; README has a prominent security section                    |
| **One of us disappears mid-project**                                             | Low        | High   | All decisions documented in `ARCHITECTURE.md`; no "tribal knowledge" gating progress                         |

---

## 14. Definition of MVP Done

The project ships v1.0.0 when **all** of the following are true:

- [ ] All MVP scope items in §3 are working end-to-end
- [ ] All Phase Definitions of Done are signed off
- [ ] CI is green on `production`
- [ ] Both deployment paths verified manually on a fresh machine
- [ ] README, ARCHITECTURE, CHANGELOG, LICENSE, CONTRIBUTING all in place
- [ ] At least one full upgrade path tested (`v0.x` → `v1.0`) preserving data
- [ ] A tagged release exists on GitHub with release notes

---

## 15. Post-MVP Roadmap (Indicative)

Not committed; just so we don't lose them. Order is roughly by user value, not difficulty.

1. Search, filter, sort on the task list
2. Due dates + overdue indicators
3. Acceptance criteria field (toggleable)
4. Sub-categories
5. Task dependencies + "blocked" status
6. Drag-and-drop kanban view as an alternative to the list
7. Rich Markdown editor with preview toolbar
8. E2E test suite (Playwright)
9. Multi-user mode (this is the SaaS pivot — significant rework of auth + schema)

---

## 16. Reference Index

Pulling all the documentation links into one place for convenience:

- **Next.js**: [App Router](https://nextjs.org/docs/app), [Server Actions](https://nextjs.org/docs/app/getting-started/updating-data), [Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware), [Standalone Output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Docker deployment](https://nextjs.org/docs/app/getting-started/deploying#docker)
- **Prisma**: [Getting Started](https://www.prisma.io/docs/getting-started), [SQLite quickstart](https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/relational-databases-typescript-sqlite), [Postgres connection URLs](https://www.prisma.io/docs/orm/overview/databases/postgresql), [Singleton pattern for Next.js](https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices), [`migrate deploy`](https://www.prisma.io/docs/orm/prisma-migrate/workflows/production-and-testing)
- **shadcn/ui**: [Next.js installation](https://ui.shadcn.com/docs/installation/next), [Form component (RHF + Zod)](https://ui.shadcn.com/docs/components/form)
- **Auth**: [iron-session](https://github.com/vvo/iron-session)
- **Validation**: [Zod](https://zod.dev/)
- **Testing**: [Vitest](https://vitest.dev/), [Playwright (post-MVP)](https://playwright.dev/)
- **Markdown rendering**: [react-markdown](https://github.com/remarkjs/react-markdown), [remark-gfm](https://github.com/remarkjs/remark-gfm)
- **Tooling**: [Conventional Commits](https://www.conventionalcommits.org/), [Husky](https://typicode.github.io/husky/), [lint-staged](https://github.com/lint-staged/lint-staged), [Keep a Changelog](https://keepachangelog.com/)
- **Docker / CI**: [GHCR publishing](https://docs.github.com/en/actions/use-cases-and-examples/publishing-packages/publishing-docker-images), [`docker/build-push-action`](https://github.com/docker/build-push-action), [OCI annotations](https://github.com/opencontainers/image-spec/blob/main/annotations.md)

---

_This plan is a living document. Update it (and this line) when scope shifts — better to update once than to drift silently._
