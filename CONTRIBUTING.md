# Contributing

Thanks for your interest in this project.

J&L Task Manager is maintained by a two-person studio (J&L Dev Studio) and is primarily a showcase project. **We are not actively seeking external code contributions.** If you submit a pull request it may not be reviewed promptly, and there is no guarantee it will be merged.

What _is_ welcome:

- **Bug reports** — if something is broken, please tell us
- **Feature requests** — if there is something you would find useful, open a discussion

## Reporting a bug

Open a [GitHub Issue](https://github.com/J-L-Dev-Studio/Task-Management-Solution/issues/new/choose) and select the **Bug report** template. Please include:

- Steps to reproduce
- What you expected to happen
- What actually happened
- Your deployment method (Docker image / clone-and-build) and Node/Docker version

## Requesting a feature

Open a [GitHub Issue](https://github.com/J-L-Dev-Studio/Task-Management-Solution/issues/new/choose) and select the **Feature request** template. Check the [roadmap in PLAN.md](./docs/PLAN.md) first — your idea may already be planned.

---

## Local development setup

The following is provided for those who want to run the project locally for evaluation or to test a bug report.

### Prerequisites

- Node.js 20+
- npm 9+
- Git

### Steps

```bash
# Clone the repository
git clone https://github.com/J-L-Dev-Studio/Task-Management-Solution.git
cd Task-Management-Solution

# Install dependencies
npm install

# Set up local environment
cp .env.example .env
# Edit .env — set ADMIN_PASSWORD and SESSION_SECRET at minimum

# Run the development server
npm run dev
```

The app runs at `http://localhost:3000`.

### Useful commands

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the development server     |
| `npm run build`        | Production build                 |
| `npm run lint`         | Run ESLint                       |
| `npm run lint:fix`     | Run ESLint and auto-fix          |
| `npm run format`       | Format all files with Prettier   |
| `npm run format:check` | Check formatting without writing |
| `npm run typecheck`    | TypeScript type check            |

---

## Branching strategy

| Branch       | Purpose                                          |
| ------------ | ------------------------------------------------ |
| `production` | Stable releases only — protected, no direct push |
| `develop`    | Integration branch — protected, no direct push   |
| `feat/*`     | Feature branches, cut from `develop`             |
| `fix/*`      | Bug fix branches, cut from `develop`             |

All changes go through a pull request into `develop`. Releases are cut from `develop` → `production`.

## Commit conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Format:

```
<type>(<scope>): <description>
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.

Examples:

```
feat(tasks): add category filter to task list
fix(auth): correct session cookie expiry
docs: update self-hosting instructions
```
