# J&L Task Management Solution

> A self-hosted, open-source task management web app — built for individuals who want to own their data.

**Status:** 🚧 In active development. MVP targeted for `v1.0.0`. See [`PLAN.md`](./docs/PLAN.md) for the full roadmap.

---

## Why this exists

Existing task tools fall into two camps: hosted SaaS products that own your data and lock features behind subscriptions, and self-hosted alternatives that are either over-engineered for one person or feel like clones of Trello and Jira.

This project aims for a third option:

- **Self-hosted by default.** Your data lives on hardware you control.
- **Single-user focused.** No team-collaboration tax — no permission models, no workspaces, no seats.
- **Lightweight to deploy.** One Docker container, one volume, one env file.
- **Yours to extend.** MIT-licensed; fork it, modify it, ignore upstream if you want.

---

## What it is (and isn't)

**It is:**

- A web app for managing personal tasks
- Designed for desktop, usable on mobile
- Built to be self-hosted via Docker
- Inspired by GitHub Issues, Trello, and Jira — but distinct from all three

**It isn't:**

- A team collaboration tool
- A hosted SaaS (a hosted version may exist later — separate product)
- A Trello/Jira clone — feature parity is not a goal
- Ready for production use yet (see status above)

For the full scope and what's deferred, see [`PLAN.md` § 3](./docs/PLAN.md).

---

## Tech stack

| Layer        | Choice                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| Framework    | Next.js (App Router) + TypeScript                                                            |
| Styling      | Tailwind CSS + [shadcn/ui](https://ui.shadcn.com/)                                           |
| ORM          | [Prisma](https://www.prisma.io/)                                                             |
| Database     | SQLite (default) / Postgres (opt-in)                                                         |
| Auth         | Single admin user via env-var password ([iron-session](https://github.com/vvo/iron-session)) |
| Distribution | Docker image on GitHub Container Registry                                                    |

For the reasoning behind each choice, see [`PLAN.md` § 2](./docs/PLAN.md).

---

## Documentation

- [`PLAN.md`](./docs/PLAN.md) — full project docs/PLAN, phased delivery, definition of done
- [Developer guides](./docs/guides/README.md) — integration how-tos (auth, database, migrations, environment, rate limiting, testing)
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — local setup, branching

---

## Self-hosting

> ⚠️ **Not yet released.** The instructions below are aspirational and will be finalized at `v1.0.0`. Following them now will not produce a working install.

Two supported paths:

### Option 1 — Pre-built image (recommended for users)

```bash
# (Aspirational — will work from v1.0.0)
docker run -d \
  --name task-manager \
  -p 3000:3000 \
  -v ./data:/data \
  -e ADMIN_PASSWORD=your-strong-password \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  ghcr.io/J-L-Dev-Studio/Task-Management-Solution:stable
```

### Option 2 — Clone and build (recommended for tinkerers)

```bash
git clone https://github.com/J-L-Dev-Studio/Task-Management-Solution.git
cd Task-Management-Solution
cp .env.example .env
# Edit .env to set ADMIN_PASSWORD and SESSION_SECRET
docker compose up -d
```

---

## Development

```bash
# Clone
git clone https://github.com/J-L-Dev-Studio/Task-Management-Solution.git
cd Task-Management-Solution

# Install dependencies
npm install

# Set up local environment
cp .env.example .env

# Initialise database
npm run prisma migrate dev
npm run db:seed

# Run the dev server
npm run dev
```

The app runs at `http://localhost:3000`. Use Prisma Studio (`npm run prisma studio`) to inspect the database during development.

For local setup details, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## Design principles

The original sketch for this project listed three goals; they've been refined into the principles below, which guide design decisions throughout development:

- **Capture should be fast.** Adding a new task should take fewer clicks and less time than any existing tool the maintainers use day to day.
- **Be accessible.** The app should be usable on whatever device you reach for first — desktop or mobile.
- **Don't get in the way.** No required fields beyond a title. Categories, descriptions, and metadata are optional. The tool should adapt to how you work, not impose process.

---

## Roadmap

The full phased docs/PLAN lives in [`PLAN.md`](./docs/PLAN.md). At a glance:

- [ ] **v1.0.0 (MVP)** — core CRUD, single-admin auth, Docker distribution
- [ ] **v1.1+** — search, filter, sort; due dates; sub-categories; dependencies
- [ ] **v2.0** — drag-and-drop kanban view; rich Markdown editor

Major features are tracked as GitHub Issues with the `roadmap` label.

---

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/J-L-Dev-Studio/Task-Management-Solution/issues/new/choose). This project is maintained by a two-person studio and is not actively seeking external code contributions.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for details.

---

## License

MIT — see [`LICENSE`](./LICENSE).

This means you can self-host, modify, and redistribute this software freely. **No warranty is provided.** As with any self-hosted software, you are responsible for the security and operation of your own instance.

---

## Acknowledgements

Built by **J&L Dev Studio**, a two-person studio exploring open-source tooling.

Influenced by [GitHub Issues](https://github.com/features/issues), [Trello](https://trello.com/), [Linear](https://linear.app/), and the broader self-hosted software community ([r/selfhosted](https://www.reddit.com/r/selfhosted/), [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted)).
