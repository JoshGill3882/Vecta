# Contributing

Thanks for your interest in Vecta.

Vecta is a personal project with a single maintainer. Bug reports, feature requests, and pull requests are all welcome — but everything is reviewed by one person, and not every change will be merged. The two rules below exist so that nobody spends an evening on something that was never going to land.

**Open an issue before starting substantial work.** A short conversation first costs you nothing and is the only way to find out early that an idea is off the roadmap. Small self-contained fixes — a typo, a broken link, an obvious bug — can go straight to a pull request without one.

**Check the scope first.** [`ROADMAP.md`](./ROADMAP.md) lists what is planned, what is being considered, and what has been ruled out along with the reasoning. Something under "Not planned" is a "no" by default; making the case against the reason given is a fair opening move, and a better one than a pull request nobody asked for.

### What gets merged

- CI is green — lint, typecheck, and both test suites pass
- Behaviour changes come with tests (see the [testing guide](./docs/guides/testing.md))
- The change reads like the code around it rather than introducing a new style
- The scope matches whatever the issue agreed — unrelated drive-by changes get asked out again

## Reporting a bug

Open a [GitHub Issue](https://github.com/JoshGill3882/Vecta/issues/new/choose) and select the **Bug report** template. Please include:

- Steps to reproduce
- What you expected to happen
- What actually happened
- Your deployment method (Docker image / clone-and-build) and Node/Docker version

## Requesting a feature

Open a [GitHub Issue](https://github.com/JoshGill3882/Vecta/issues/new/choose) and select the **Feature request** template. Check the [roadmap](./ROADMAP.md) first — your idea may already be planned, or already ruled out with a reason.

---

## Local development setup

For running the app itself rather than working on it, self-hosting via Docker is the simpler route — see the [README](./README.md#self-hosting). The steps below are for running from source.

### Prerequisites

- Node.js 20+
- npm 9+
- Git

### Steps

```bash
# Clone the repository
git clone https://github.com/JoshGill3882/Vecta.git
cd Vecta

# Install dependencies
npm install

# Set up local environment
cp .env.example .env
# Edit .env — set ADMIN_PASSWORD and SESSION_SECRET at minimum

# Generate the Prisma clients
npm run db:generate

# Create the local database and apply migrations
npm run db:migrate

# Optional: load some example categories and tasks
npm run db:seed

# Run the development server
npm run dev
```

The app runs at `http://localhost:3000`.

`db:generate` is a required step rather than a convenience: the generated
clients live in `generated/`, which is gitignored, and the app imports from
them directly — so a fresh clone will not typecheck or build until it has run.

### Useful commands

| Command                | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Start the development server                    |
| `npm run build`        | Production build                                |
| `npm test`             | Run the unit and integration suites once        |
| `npm run test:watch`   | Run the suites in watch mode                    |
| `npm run lint`         | Run ESLint                                      |
| `npm run lint:fix`     | Run ESLint and auto-fix                         |
| `npm run format`       | Format all files with Prettier                  |
| `npm run format:check` | Check formatting without writing                |
| `npm run typecheck`    | TypeScript type check                           |
| `npm run db:generate`  | Generate the Prisma clients for both providers  |
| `npm run db:migrate`   | Create and apply a migration (development)      |
| `npm run db:deploy`    | Apply existing migrations (what the image runs) |
| `npm run db:seed`      | Load example data — safe to re-run              |
| `npm run db:reset`     | Drop, re-migrate and re-seed the local database |
| `npm run db:studio`    | Open Prisma Studio to inspect the database      |

Every `db:*` command resolves the datasource provider from `DATABASE_URL`
first, so the same command works whether you are on SQLite or Postgres.

New to the codebase? [`ARCHITECTURE.md`](./ARCHITECTURE.md) is the fastest way
in, and [`docs/guides/`](./docs/guides/README.md) covers each area in detail.

---

## AI assistant knowledge graph (Graphify)

This project uses [Graphify](https://github.com/safishamsi/graphify) to give AI coding assistants (Claude Code, Cursor, Codex, etc.) a structured knowledge graph of the codebase instead of raw grepping. The graph lives in `graphify-out/` which is gitignored — each developer builds it locally.

### One-time setup

```bash
# Install graphify (requires Python 3.9+)
pip install graphifyy

# Build your local graph (AST-only, no API key needed, ~seconds)
graphify update .
```

> **Optional — richer semantic graph:** If you have a Gemini API key you can run a deeper extraction once:
>
> ```bash
> GEMINI_API_KEY=<your-key> graphify extract . --backend gemini
> ```
>
> This embeds semantic relationships on top of the AST graph. Subsequent `graphify update .` calls stay free.

### Day-to-day usage

Keep the graph current after any significant code change:

```bash
graphify update .   # re-indexes changed files, no API cost
```

Query the graph instead of grepping:

```bash
graphify query "how are tasks stored?"
graphify path "TaskList" "database"
graphify explain "session middleware"
```

The `graphify-out/GRAPH_REPORT.md` file gives a broad architecture overview if you need it.

### Claude Code hook

When you run `graphify claude install` (already committed in `.claude/settings.json`), Claude Code automatically gets a reminder to query the graph before running `grep`/`find` searches. No extra configuration needed — the hook fires as long as `graphify` is on your `PATH`.

---

## Branching strategy

| Branch                  | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `production`            | Stable releases only — protected, no direct push |
| `develop`               | Integration branch — protected, no direct push   |
| `<issue-number>-<slug>` | Work branches, cut from `develop`                |

Work branches are named after the issue they close — `73-tag-the-v010-release`.
Create the branch from the issue rather than by hand, using **Create a branch**
in the issue's sidebar or `gh issue develop <number> --base develop`. Either way
GitHub derives the name and links the branch to the issue, so the issue tracks
the branch and its eventual pull request without anyone wiring it up.

Then check it out locally:

```bash
git fetch origin
git switch <issue-number>-<slug>
```

All changes go through a pull request into `develop`. Releases are cut from `develop` → `production`.

### Fixing a released version urgently

A fix that cannot wait for whatever is sitting unreleased on `develop` branches from `production` instead:

```bash
git fetch origin
git switch -c <issue-number>-<slug> origin/production
```

Merge it into `production`, tag the patch release from there, then merge `production` back into `develop` so the fix is not lost at the next release.

Branching from `develop` would be the mistake here: the fix would carry every unreleased change sitting on it, and the patch release would stop being a patch.

---

## Milestones

Milestones are named for the release they target — `v1.1`, `v1.2` — and each one's description says what that release is about. `Phase N` milestones are from before v1.0.0 and are kept as the record of how it was delivered.

Three things worth knowing before you file:

- **Most issues have no milestone, and that is the normal state.** One is assigned when an issue becomes planned for a specific release; until then, no milestone means unscheduled rather than neglected.
- **Setting one is the maintainer's call.** Please leave it unset on a new issue rather than guessing at a release.
- **A milestone is a plan, not a promise.** Issues move between them as priorities change, which is the same reason [`ROADMAP.md`](./ROADMAP.md) carries no dates.
