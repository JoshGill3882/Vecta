# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries describe changes as a user of the app experiences them. Internal
refactors that change nothing observable are not listed.

## [Unreleased]

### Added

- Tasks with a title, optional Markdown description, category, and an open /
  in progress / closed status, grouped into collapsible sections
- Inline quick-add — type a title, press Enter
- Categories, each with an assignable colour. Deleting a category keeps its
  tasks and leaves them uncategorised
- Single-admin authentication with an encrypted session cookie
- Mobile-responsive layout, usable from phone width upwards
- `GET /api/health` liveness endpoint for Docker healthchecks and reverse
  proxies
- Docker image built for `linux/amd64` and `linux/arm64`, applying database
  migrations on start
- `docker-compose.yml` and `docker-compose.prod.yml` covering the
  build-from-clone and pre-built-image self-hosting paths
- PostgreSQL as an opt-in alternative to the default SQLite, served by the same
  image and selected by the shape of `DATABASE_URL`
- Images published to GitHub Container Registry and signed with cosign
- `README.md` covering configuration, backup and restore, and upgrades, and
  `ARCHITECTURE.md` covering the shape of the codebase

### Security

- The app refuses to start when `ADMIN_PASSWORD` is missing, or when
  `SESSION_SECRET` is missing or shorter than 32 characters
- Login attempts are rate-limited, and the password comparison is
  timing-safe
- The post-login redirect only accepts same-origin absolute paths

[unreleased]: https://github.com/J-L-Dev-Studio/Task-Management-Solution/commits/develop
