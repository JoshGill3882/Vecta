---
name: Bug report
about: Create a report to help us improve
title: ""
labels: bug
assignees: ""
type: Bug
---

## Summary

<!-- A concise description of the bug. What is broken, and what is the impact? -->

---

## Definition of Ready

> All boxes must be checked before this issue can enter a sprint.

- [ ] Bug is reproducible (or non-reproducibility is itself documented)
- [ ] Steps to reproduce are clearly defined
- [ ] Expected vs. actual behaviour is described
- [ ] Affected environment(s) identified (prod / staging / local)
- [ ] Severity and priority assigned (see below)
- [ ] Dependencies identified and noted
- [ ] Root cause hypothesis documented (even if unconfirmed)
- [ ] Security / data-integrity implications considered
- [ ] Regression risk assessed — could fixing this break something else?

---

## Steps to Reproduce

<!-- Be as specific as possible. Assume the reader has no prior context. -->

1.
2.
3.

---

## Expected vs. Actual Behaviour

|              | Behaviour               |
| ------------ | ----------------------- |
| **Expected** | _What should happen_    |
| **Actual**   | _What actually happens_ |

---

## Environment

| Field                    | Detail                             |
| ------------------------ | ---------------------------------- |
| **Environment**          | _Production / Staging / Local_     |
| **Browser / Client**     | _e.g. Chrome 123, iOS 17, Postman_ |
| **App Version / Commit** | _e.g. v2.4.1 / `abc1234`_          |
| **OS**                   | _e.g. Windows 11, macOS Sonoma_    |
| **Reproducibility**      | _Always / Intermittent / Once_     |

---

## Severity & Priority

<!-- Severity = how bad is the impact. Priority = how urgently should it be fixed. These are not always the same. -->

**Severity:**

- [ ] 🔴 Critical — system down, data loss, security breach, or total blocker
- [ ] 🟠 High — major feature broken, significant user impact, no workaround
- [ ] 🟡 Medium — feature partially broken, workaround exists
- [ ] 🟢 Low — cosmetic, minor inconvenience, edge case

**Priority:**

- [ ] P1 — Fix immediately / hotfix required
- [ ] P2 — Fix in current sprint
- [ ] P3 — Fix in next sprint
- [ ] P4 — Fix when time allows / backlog

---

## Dependencies

<!-- Anything that must be resolved before this fix can be worked on or deployed. -->

| Dependency              | Type                    | Status           | Link   |
| ----------------------- | ----------------------- | ---------------- | ------ |
| _e.g. Upstream API bug_ | _Service / PR / Ticket_ | _Pending / Done_ | _#123_ |

---

## Evidence

<!-- Attach screenshots, screen recordings, logs, stack traces, or network request/response payloads. -->

<details>
<summary>Stack Trace / Logs</summary>

```
Paste stack trace or log output here
```

</details>

<details>
<summary>Request / Response (if applicable)</summary>

```json

```

</details>

---

## Root Cause Hypothesis

<!-- What do you think is causing this? Even an educated guess helps. Leave blank if genuinely unknown. -->

---

## Considerations

### Security & Data Integrity

<!-- e.g. Is user data exposed or corrupted? Could this be exploited? Does it need immediate mitigation? -->

### Regression Risk

<!-- e.g. What areas of the codebase could be affected by a fix? What should be regression-tested? -->

### Workaround

<!-- Is there a temporary workaround users or support can use while the fix is in progress? -->

---

## Acceptance Criteria

<!-- Define exactly what "fixed" looks like. Each criterion should be independently testable. -->

- [ ] **AC1:** The original steps to reproduce no longer produce the bug
- [ ] **AC2:**
- [ ] **AC3:**

---

## Definition of Done

> All boxes must be checked before this issue can be closed.

### Verified by CI

<!-- Maintained automatically. Cleared when a CI run starts and ticked by the
     job that proves each claim, so this section always describes the commit
     under test. Edits inside the markers are overwritten. -->

<!-- ci:dod:start -->

- [ ] Lint, typecheck and build pass
- [ ] Test suite passes — no new regressions
- [ ] Compose files validate

<!-- ci:dod:end -->

### Requires human judgement

- [ ] Root cause identified and documented in this ticket
- [ ] All Acceptance Criteria met and verified
- [ ] Code reviewed and approved (per branch/PR policy)
- [ ] Automated test added that would have caught this bug (regression test)
- [ ] Error handling reviewed and improved where the bug originated
- [ ] Logging / observability confirmed — this failure mode will be visible in future
- [ ] Documentation updated if behaviour change affects expected usage
- [ ] Fix tested in staging / pre-prod environment
- [ ] Affected users notified (if applicable)

---

## Additional Context

<!-- Related issues, prior occurrences, external references, or anything else the team should know. -->
