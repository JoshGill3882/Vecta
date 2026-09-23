# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries describe changes as a user of the app experiences them.
Internal refactors that change nothing observable are not listed.

## [Unreleased]

## [1.1.0] - 2026-09-21

Making a longer task list usable: search, filter and sort.

### Added

- **Search the task list** by title and description.
  Matches are highlighted where they appear, and the header reports how many of your tasks matched.
  Press `/` from anywhere on the page to jump to the field, and `Esc` to clear it
- **Filter the task list by category**, choosing any number of them at once.
  Tasks with no category are reachable through an explicit **Uncategorised** option, so nothing can hide behind a filter.
  Deleting a category while it is selected drops it from the filter rather than leaving you with an empty list
- **Sort the task list**, by recently updated, oldest first, or title in either direction.
  The choice is remembered across reloads and follows you between open tabs.
  Ordering applies within each status section, so the sections themselves stay in their usual order

Search, filtering and sorting all compose: narrow by both a query and a category, and the result is sorted the way you chose.

### Changed

- **A status section holding no tasks now shows only its heading and a count.**
  It previously offered a collapse control for a section with nothing in it, and a line of text repeating what the count already said
- **Collapsed sections reset once when you upgrade.**
  Which sections are folded is now remembered differently, and the old setting is not carried over.
  Fold them again and the choice sticks as before
- The published image no longer includes the Prisma command-line tool, which was never used at runtime

### Fixed

- The **"No tasks yet"** message appeared _below_ the three empty status sections rather than replacing them, so a new install looked like it had a list and a message rather than neither
- The **favicon** was almost entirely soft glow with nothing solid behind it, leaving it close to invisible in a light-themed tab strip
- The task list **no longer flashes its default order** before settling.
  Your sort order and folded sections are now applied to the page as it arrives, rather than corrected a moment after it appears

### Security

- Dependency advisories reported by Dependabot are cleared, including transitive ones pinned ahead of their upstream fixes

## [1.0.0] - 2026-09-07

### Changed

- The project is now **Vecta**, hosted at `github.com/JoshGill3882/Vecta`.
  The old repository URL redirects, but published images move:
  pull `ghcr.io/joshgill3882/vecta` rather than `ghcr.io/j-l-dev-studio/task-management-solution`.
  Images already published under the old path are unaffected and stay where they are
- `TMS_VERSION` is now `VECTA_VERSION`.
  Rename it in your `.env` before upgrading — an unrecognised variable is ignored silently, which resolves the image to `latest` rather than to the version you pinned
- The optional Postgres service's database is named `vecta` rather than `taskmanager`.
  Existing Postgres deployments should leave `POSTGRES_DB` and the `DATABASE_URL` database name as they are;
  the data is keyed to the old name
- The session cookie is named `Vecta-Auth` rather than `Task-Manager-Auth`.
  Upgrading signs you out once — the old cookie is ignored rather than read, so sign in again and the new one replaces it

### Fixed

- Setting `PORT` no longer leaves the app unreachable and the container permanently unhealthy.
  The container always listens on 3000 and `PORT` moves only the host side, which is what the configuration table always described
- New categories are given a default colour that meets AA contrast as chip text.
  Categories that already have a colour keep it

### Upgrading from 0.1.0

Cloning fresh into `Vecta/` rather than `Task-Management-Solution/` changes the Compose project name, and with it the volume Compose looks for — a rename from `task-management-solution_app-data` to `vecta_app-data`.
The app will come up against an empty database while the old volume sits untouched beside it.
Either keep the old directory name, or pass `-p task-management-solution` to `docker compose`, or back up and restore into the new volume following the backup instructions in the README.

## [0.1.0] - 2026-08-30

### Added

- Tasks with a title, optional Markdown description, category, and an open / in progress / closed status, grouped into collapsible sections
- Inline quick-add — type a title, press Enter
- Categories, each with an assignable colour.
  Deleting a category keeps its tasks and leaves them uncategorised
- Single-admin authentication with an encrypted session cookie
- Mobile-responsive layout, usable from phone width upwards
- `GET /api/health` liveness endpoint for Docker healthchecks and reverse proxies
- Docker image built for `linux/amd64` and `linux/arm64`, applying database migrations on start
- `docker-compose.yml` and `docker-compose.prod.yml` covering the build-from-clone and pre-built-image self-hosting paths
- PostgreSQL as an opt-in alternative to the default SQLite, served by the same image and selected by the shape of `DATABASE_URL`
- Images published to GitHub Container Registry and signed with cosign
- `README.md` covering configuration, backup and restore, and upgrades, and `ARCHITECTURE.md` covering the shape of the codebase

### Security

- The app refuses to start when `ADMIN_PASSWORD` is missing, or when `SESSION_SECRET` is missing or shorter than 32 characters
- Login attempts are rate-limited, and the password comparison is timing-safe
- The post-login redirect only accepts same-origin absolute paths

[unreleased]: https://github.com/JoshGill3882/Vecta/compare/v1.1.0...main
[1.1.0]: https://github.com/JoshGill3882/Vecta/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/JoshGill3882/Vecta/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/JoshGill3882/Vecta/releases/tag/v0.1.0
