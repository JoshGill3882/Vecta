---
name: Decision
about: A question that has to be answered before something can be built
title: ""
labels: decision
assignees: ""

---

<!--
For questions, not work. The issue closes when the answer is recorded; the code
that follows belongs to the issues this one blocks.

Keep it short enough to answer without reading a specification first. If that
is not possible, it is really several questions: split it.
-->

## The question

<!-- One sentence, ending in a question mark. -->

---

## Why it matters

<!--
What breaks, gets built twice, or has to be undone if this is answered wrong or
late. Concrete beats abstract: name the screen, the data or the cost.
-->

---

## Options

| Option | Consequence |
| --- | --- |
| _Option A_ | _What follows if it is chosen_ |
| _Option B_ | _What follows if it is chosen_ |

---

## Recommendation

<!--
Say which option and why, even when the call is not yours to make. A question
with a recommendation attached gets answered; one without it sits.

If it is genuinely a coin toss, say so. That tells the decider to pick quickly
rather than go and research.
-->

---

## Blocks

<!--
Record what waits on this as GitHub issue dependencies (the sidebar's
"Relationships"), not as a list here, so it stays current as issues move.
-->

<!--
HOW THE ANSWER IS RECORDED

Nothing above is edited once the issue is created. It is the question as it was
asked and the options as they stood, and a body edited after the fact cannot be
told apart from one that always said that.

The answer is a comment on this issue. It says what was decided, and why the
rejected options lost: that second half is what stops the question being
reopened later by someone who can see only the outcome. A recommendation that
was overturned stays as written, and the comment says why it was overturned.

A pull request then records the answer in the document that raised the
question, usually ARCHITECTURE.md or ROADMAP.md, and closes this issue. The
document is the long-lived record; this issue is how the answer got there.
-->
