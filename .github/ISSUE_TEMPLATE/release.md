---
name: Release
about: Prepare, tag and publish one version — one per milestone, filed in it
title: "Release vX.Y.0"
labels: chore
assignees: ""

---

<!--
One of these sits in every release milestone, alongside the work it ships.

It has no "blocked by" relationships. GitHub can only block an issue on other
issues, not on a milestone, and keeping a list in step with the milestone by
hand is exactly the bookkeeping that drifts. The milestone's own list is the
blocker: when this is its last open issue, the release is ready to prepare.

Do not create the branch with "Create a branch" in the sidebar, or with
`gh issue develop` (the GitHub CLI's command for the same thing, whatever the
base branch). A branch made either way is linked to this issue, and a linked
branch closes this issue as soon as its pull request merges, before the tag
and the release below exist. Cut it by hand instead, and write "Part of #N"
rather than "Closes #N" in the pull request:

  git switch -c <issue-number>-release-vX.Y.0 origin/main

Close this issue by hand once the last box is ticked.
-->

## Overview

Prepares, tags and publishes **vX.Y.0**, the release the **vX.Y** milestone targets.

---

## Ready to prepare

- [ ] Every other issue in the vX.Y milestone is closed, or moved to a later milestone

---

## Preparation pull request

- [ ] **`CHANGELOG.md`:** `[Unreleased]` becomes `[X.Y.0] - YYYY-MM-DD`, checked against the closed milestone so nothing a user would notice is missing, under a new empty `[Unreleased]`
- [ ] **`CHANGELOG.md` links:** `[unreleased]` compares `vX.Y.0...main`, and a new `[X.Y.0]` compares the previous version to `vX.Y.0`
- [ ] **Version:** `npm version X.Y.0 --no-git-tag-version`, which updates `package.json` and both places `package-lock.json` records it
- [ ] **`ROADMAP.md`:** what this release ships leaves **Next**, and **Next** points at the following milestone
- [ ] **Other docs:** nothing else states which version is current (the README shows it as a badge, and its example versions illustrate syntax)
- [ ] Pull request merged into `main`

---

## Release

- [ ] **Tag** the merge commit: `git tag -a vX.Y.0 -m vX.Y.0 <merge-sha>`, then `git push origin vX.Y.0`. `publish.yml` builds `:vX.Y.0` and, for a version with no prerelease suffix, moves `:latest`
- [ ] **Publish** a GitHub release from the tag, with the version's changelog section as its notes. `release-assets.yml` attaches `docker-compose.prod.yml` and `env.example`
- [ ] **Verify:** the release carries both assets, `docker pull ghcr.io/joshgill3882/vecta:vX.Y.0` succeeds, and the README badge reads vX.Y.0
- [ ] **Close** the vX.Y milestone, then this issue
