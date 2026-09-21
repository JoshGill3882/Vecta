# Summary

<!--
  Explain the *what* and *why* — not the how (the diff covers that).
  What problem does this solve? What decision was made and why?
  If this is non-obvious, future-you will thank present-you.
-->

---

## What Changed

<!--
  A brief, scannable list of the meaningful changes in this PR.
  Focus on decisions and non-obvious choices — not a rehash of the commit log.
-->

-
-
-

---

## How to Test

<!--
  Give the reviewer enough context to verify this themselves.
  Include any setup steps, test accounts, environment variables, or flags needed.
  If this is fully covered by automated tests, say so — but don't just say "run the tests".
-->

**Steps:**

1.
2.
3.

**Expected outcome:**

---

## Deployment Notes

<!-- Anything that needs to happen at deploy time or shortly after. Delete if not applicable. -->

- [ ] No special deployment steps required
- [ ] Requires environment variable changes — _detail below_
- [ ] Requires database migration — _detail below_
- [ ] Requires feature flag to be enabled/disabled
- [ ] Requires dependent service to be deployed first — _detail below_
- [ ] Requires manual post-deploy step — _detail below_

---

## Screenshots / Recordings

<!-- For UI changes, before/after screenshots or a short screen recording go a long way. Delete if not applicable. -->

| Before | After |
| ------ | ----- |
| _n/a_  | _n/a_ |

---

## Risks & Areas of Concern

<!--
  Be honest. What are you least confident about?
  What should the reviewer stress-test or pay extra attention to?
  Where might edge cases hide?
  If you're unsure about nothing, write "None identified" — but think first.
-->

---

## Author Checklist

> _Complete this before marking the PR as ready for review. This is a self-check, not a rubber stamp._

- [ ] I have reviewed my own diff before requesting review
- [ ] New or changed logic is covered by tests
- [ ] I have not introduced debug code, commented-out blocks, or console/debug logs
- [ ] Error handling is appropriate for new code paths
- [ ] Any hardcoded values, magic numbers, or non-obvious decisions are commented
- [ ] This PR is appropriately scoped — it does one thing, or there's a good reason it doesn't

---

## Reviewer Focus

<!--
  Optional but appreciated. Guide the reviewer to where their attention matters most.
  e.g. "Particularly interested in feedback on the caching strategy in UserService.cs"
       "The data migration in step 2 — please scrutinise this carefully"
       "Happy to walk this through on a call if easier"
-->
