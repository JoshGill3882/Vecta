// Guard: Acceptance-Criteria labels must not leak into code, tests, or docs.
//
// ACs are issue-scoped — an `AC1`/`AC2` label only makes sense alongside the
// issue/PR that numbered them, and becomes meaningless once the feature branch is
// merged. They belong in the issue itself (see .github/ISSUE_TEMPLATE/), never in
// long-lived source. This check fails CI (and pre-commit) if an `AC<n>` label
// appears anywhere it would outlive its issue.
//
// Note: it matches the label form (`AC` + digit) ONLY — the spelled-out phrase
// "acceptance criteria" is a legitimate product term (e.g. a task field in
// docs/PLAN.md) and is deliberately not flagged.
//
// Run: `npm run check:ac`  (also wired into CI and the husky pre-commit hook)

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Where AC references are legitimate and expected — the issue templates.
const ALLOWED_PREFIXES = [".github/"];
// This guard file necessarily names the patterns it hunts for; don't scan it.
const SELF = "scripts/check-no-ac-refs.mjs";

// Only text we author: code + docs. (Data files like JSON are skipped to avoid
// false positives on incidental "AC1"-looking values.)
const SCANNED_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx|md)$/;

// An `AC` immediately followed by a digit (AC1, AC2/AC3, AC12), on a word
// boundary so "HMAC1"/"MAC2" don't trip it.
const AC_LABEL = /\bAC\d/;

function trackedFiles() {
  return execSync("git ls-files", { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((f) => SCANNED_EXT.test(f))
    .filter((f) => f !== SELF)
    .filter((f) => !ALLOWED_PREFIXES.some((p) => f.startsWith(p)));
}

const offenders = [];
for (const file of trackedFiles()) {
  let lines;
  try {
    lines = readFileSync(file, "utf8").split("\n");
  } catch {
    continue; // unreadable / vanished between ls-files and now — skip
  }
  lines.forEach((line, i) => {
    if (AC_LABEL.test(line)) {
      offenders.push(`${file}:${i + 1}: ${line.trim()}`);
    }
  });
}

if (offenders.length > 0) {
  console.error(
    "\n✖ Acceptance-Criteria references found outside .github/ (they're issue-scoped —\n" +
      "  describe the behaviour directly instead, and keep ACs in the issue/PR):\n"
  );
  console.error(offenders.map((o) => "    " + o).join("\n"));
  console.error(
    `\n  ${offenders.length} reference(s). Remove them and re-run \`npm run check:ac\`.\n`
  );
  process.exit(1);
}

console.log("✓ No Acceptance-Criteria references outside .github/");
