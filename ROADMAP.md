# Roadmap

What is planned for Vecta, what is being considered, and what has been ruled out.

> **This is indicative, not a commitment.** Vecta is maintained by one person in whatever time is going spare.
> Items move between sections, and something being listed here is not a promise that it ships.

Items are grouped by how likely they are, not by when.
There are no dates — [see below](#why-there-are-no-dates).

---

## Next

Planned, and the most likely candidates for the release after the current one.

- **Search, filter and sort on the task list.** The first thing that stops scaling.
  Status grouping is the only organisation there is today, which is fine at thirty tasks and not at three hundred.
  Split across [#111](https://github.com/JoshGill3882/Vecta/issues/111), [#112](https://github.com/JoshGill3882/Vecta/issues/112) and [#113](https://github.com/JoshGill3882/Vecta/issues/113).
- **Due dates and overdue indicators.** The most-requested shape of task metadata, and the one the list view has an obvious place to show.
  Split across [#114](https://github.com/JoshGill3882/Vecta/issues/114) and [#115](https://github.com/JoshGill3882/Vecta/issues/115).

## Later

Intended, but unscheduled.
Roughly in order of how useful they seem, not how hard they are.

- **Acceptance criteria on a task**, as a toggleable checklist.
- **Sub-categories.** Categories are deliberately flat today;
  nesting is the natural next step once there are enough of them to want grouping.
- **Task dependencies and a "blocked" status.** These belong together — a blocked status without a reason attached is just a fourth column.
- **Installing to a phone's home screen.** The layout already works on mobile;
  what is missing is the manifest that lets a browser install it, so it opens in its own window under an icon that looks like the app rather than one a launcher invents for a bookmark.
  [#117](https://github.com/JoshGill3882/Vecta/issues/117).
- **A drag-and-drop kanban view**, as an alternative to the list rather than a replacement for it.
- **A richer Markdown editor** with a preview toolbar.
  The current plain textarea renders on save, which is enough but not pleasant.
- **An end-to-end test suite** (Playwright).
  Deliberately skipped for the MVP;
  the unit and integration suites cover the logic, and E2E covers the wiring between it and the browser.
- **Multi-user mode.** Far and away the largest item here:
  accounts, sessions and a schema that no longer assumes one owner.
  Worth being clear that this changes what Vecta is — being single-user is a decision today, not a gap waiting to be filled — but it is genuinely on the list rather than ruled out.

## Not planned

Things that come up, with the reason they are a "no".
A reason can stop being true, so these are arguments rather than final answers — but assume they hold unless something changes them.

- **Team collaboration: assignment, comments, mentions, permissions.** Distinct from multi-user accounts above.
  Multiple people _having_ logins is a schema problem;
  multiple people _working the same board_ is a product, with notification, permission and conflict questions attached to every feature after it.
  That is not what this is for.
- **A hosted, paid version of Vecta.** If a hosted service ever exists it will be a separate product with a separate name.
  Nothing in this repository will be held back or degraded to make room for one.
- **Feature parity with Trello, Jira or Linear.** Vecta borrows from them and is not trying to replace them.
  "Tool X has this" is not on its own an argument for adding it here.
- **Email notifications.** A scheduler, SMTP configuration and deliverability problems, in exchange for telling one person something about a tool they already have open.
  The cost is not close to the benefit for a single-user app.

---

## Why there are no dates

A dated roadmap from a one-person project maintained in spare evenings is a promise that gets broken, and a roadmap nobody believes is worse than none.
What you get instead is honest ordering:
everything under **Next** is genuinely what comes next, and everything under **Later** is genuinely wanted but unscheduled.

Individual work is tracked in [GitHub Issues](https://github.com/JoshGill3882/Vecta/issues).
Where an item here has an issue, it links to it — the issue holds the detail and this file stays an index.

Something missing, or listed in the wrong place?
Open an issue and make the case.
See [`CONTRIBUTING.md`](./CONTRIBUTING.md).
