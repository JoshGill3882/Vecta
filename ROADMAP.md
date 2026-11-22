# Roadmap

What is planned for Vecta, what is being considered, and what has been ruled out.

> **This is indicative, not a commitment.** Vecta is maintained by one person in whatever time is going spare.
> Items move between sections, and something being listed here is not a promise that it ships.

Items are grouped by how likely they are, not by when.
There are no dates — [see below](#why-there-are-no-dates).

---

## Next

Scheduled: each item here has a milestone and issues.
They are tracked in the [v1.3](https://github.com/JoshGill3882/Vecta/milestone/11) and [v1.4](https://github.com/JoshGill3882/Vecta/milestone/12) milestones.

- **Logging, and a record of what changed.** When something goes wrong on the server, the app says "Something went wrong" and nothing is kept that says why.
  Server errors and start-up are logged to stdout, which keeps working when the database does not, and to a table the app can read.
  Changes to tasks and categories are recorded alongside them, so there is a history of what happened to your data and when.
  A Logs page in the app lists the entries and searches them, and can export or clear them, while old entries age out on their own.
  Split across [#169](https://github.com/JoshGill3882/Vecta/issues/169), [#170](https://github.com/JoshGill3882/Vecta/issues/170) and [#171](https://github.com/JoshGill3882/Vecta/issues/171), then the Logs page in [#223](https://github.com/JoshGill3882/Vecta/issues/223), [#224](https://github.com/JoshGill3882/Vecta/issues/224), [#225](https://github.com/JoshGill3882/Vecta/issues/225), [#226](https://github.com/JoshGill3882/Vecta/issues/226), [#227](https://github.com/JoshGill3882/Vecta/issues/227), [#231](https://github.com/JoshGill3882/Vecta/issues/231), [#233](https://github.com/JoshGill3882/Vecta/issues/233) and [#235](https://github.com/JoshGill3882/Vecta/issues/235).
  In v1.3.
- **Getting around a long list.** On a long list, changing a filter, adding a task or exporting the log means scrolling back to the top first.
  The Task list, the Logs page and the Categories page keep their heading, main buttons and filters pinned below the top bar as the list scrolls, with the list's own section and day headings pinned beneath them, and a Back to top button appears once a page is scrolled more than a screen down.
  The Categories page, the only one without a search, gains one, with a Sort menu ordering it by name or by how many tasks each category has.
  Split across [#242](https://github.com/JoshGill3882/Vecta/issues/242), [#243](https://github.com/JoshGill3882/Vecta/issues/243), [#244](https://github.com/JoshGill3882/Vecta/issues/244) and [#245](https://github.com/JoshGill3882/Vecta/issues/245), in v1.4.

## Later

Intended, but unscheduled.
Roughly in order of how useful they seem, not how hard they are.

- **A Settings page.** A light, dark or system theme, a 12- or 24-hour clock, and which day the week starts on in the due-date calendar.
  On a phone, the tabs move to a bar along the bottom of the screen, with Settings beside Tasks, Categories and Logs, and Log out moves into Settings.
- **A drag-and-drop board view**, as an alternative to the list rather than a replacement for it, chosen in Settings.
  Moving a card between columns changes its status, with a way to do the same from the keyboard.
  Large enough to be a release of its own rather than part of another.
- **Acceptance criteria on a task**, as a toggleable checklist.
- **Sub-categories.** Categories are deliberately flat today;
  nesting is the natural next step once there are enough of them to want grouping.
- **Task dependencies and a "blocked" status.** These belong together — a blocked status without a reason attached is just a fourth column.
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
