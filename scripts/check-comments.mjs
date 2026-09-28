// Guard: comments follow the two rules of docs/guides/comments.md that a script
// can check.
//
// 1. No issue references. A comment saying `(#50)` needs the issue tracker open to
//    be understood, so it stops working the moment someone reads the file on its
//    own - and it dates the comment without explaining the code. The reasoning
//    belongs in the comment; the number belongs in the commit that made the change.
//    Only `app/`, `src/` and `test/` are scanned for these: documentation and
//    tooling legitimately link to issues, and `.github/` is where they are authored.
//
// 2. A doc block opens with its summary. A folded block shows only its first
//    line, so `/**` alone there folds to nothing useful. Every directory holding
//    authored code is scanned for this, tooling included.
//
// Run: `npm run check:comments`  (also wired into CI and the husky pre-commit hook)

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Directories scanned for issue references: code, where a reader has no tracker to hand. */
const ISSUE_REF_PREFIXES = ["app/", "src/", "test/"];

/** Directories scanned for doc blocks: every one that holds code we author. */
const DOC_BLOCK_PREFIXES = ["app/", "src/", "test/", "scripts/", "prisma/"];

/** This guard names the pattern it hunts for, so it is not scanned for issue references. */
const SELF = "scripts/check-comments.mjs";

/** Source we author. Data files are skipped: a `#1234` in one is not prose. */
const SCANNED_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/;

/** A `#` and one to four digits, as an issue reference is written.
 *
 * The lookarounds keep it off colours. `#123456` fails because no digit run of
 * four or fewer ends on a word boundary, and `#3b9eff` fails because a digit
 * must not be followed by another hex character. Three-digit shorthand like
 * `#123` would match, and is not used here — the category schema rejects it.
 */
const ISSUE_REF = /(?<![0-9a-fA-F#])#(\d{1,4})\b(?![0-9a-fA-F])/;

/** Every tracked source file under the given directories.
 *
 * @param prefixes Repository-relative directories, each ending in `/`.
 * @returns Repository-relative paths.
 */
function sourceFiles(prefixes) {
  return execSync("git ls-files", { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((f) => SCANNED_EXT.test(f))
    .filter((f) => prefixes.some((p) => f.startsWith(p)));
}

/** Extracts the comment text from source, with the line each piece sits on.
 *
 * Walks the source rather than matching per line, because a `//` inside a
 * string literal is not a comment and a `#50` in a URL should not be reported.
 * Strings and template literals are skipped wholesale for the same reason.
 *
 * @param source The file contents.
 * @returns One entry per comment, with its 1-based starting line.
 */
export function commentsIn(source) {
  const found = [];
  let line = 1;
  let i = 0;

  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];

    if (c === "\n") {
      line++;
      i++;
    } else if (c === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? source.length : end;
      found.push({ line, text: source.slice(i + 2, stop) });
      i = stop;
    } else if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end;
      const text = source.slice(i + 2, stop);
      found.push({ line, text });
      line += text.split("\n").length - 1;
      i = stop + 2;
    } else if (c === '"' || c === "'" || c === "`") {
      // Skip the literal, honouring escapes so a closing quote is not missed.
      i++;
      while (i < source.length && source[i] !== c) {
        if (source[i] === "\\") i++;
        else if (source[i] === "\n") line++;
        i++;
      }
      i++;
    } else {
      i++;
    }
  }

  return found;
}

/** Finds issue references in a file's comments.
 *
 * @param source The file contents.
 * @returns One entry per offending comment, with its line and the reference.
 */
export function issueRefsIn(source) {
  const offenders = [];
  for (const comment of commentsIn(source)) {
    // Report against the line the reference is on, not the comment's first.
    comment.text.split("\n").forEach((text, offset) => {
      const match = ISSUE_REF.exec(text);
      if (match) offenders.push({ line: comment.line + offset, ref: match[0], text: text.trim() });
    });
  }
  return offenders;
}

/** Finds doc blocks whose opening line carries nothing but the delimiter.
 *
 * Only `/**` blocks are governed: a plain `/*` comment has no summary to fold
 * to, and a block on one line already reads in full.
 *
 * @param source The file contents.
 * @returns One entry per offending block, with the line it opens on.
 */
export function blankOpeningsIn(source) {
  return commentsIn(source)
    .filter((comment) => comment.text.startsWith("*") && comment.text.includes("\n"))
    .filter((comment) => comment.text.split("\n")[0].slice(1).trim() === "")
    .map((comment) => ({ line: comment.line }));
}

/** Reads a file, or nothing when it has gone between listing and reading.
 *
 * @param file A repository-relative path.
 * @returns The contents, or null.
 */
function read(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** Prints a failed rule's offenders under an explanation.
 *
 * @param heading What went wrong and what to do instead.
 * @param offenders One `file:line: detail` entry per violation.
 */
function report(heading, offenders) {
  console.error(`\n✖ ${heading}\n`);
  console.error(offenders.map((o) => "    " + o).join("\n"));
}

// Only when run directly, so the exports above stay importable from a spec.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const issueRefs = [];
  for (const file of sourceFiles(ISSUE_REF_PREFIXES).filter((f) => f !== SELF)) {
    const source = read(file);
    if (source === null) continue;
    for (const found of issueRefsIn(source)) issueRefs.push(`${file}:${found.line}: ${found.text}`);
  }

  const blankOpenings = [];
  for (const file of sourceFiles(DOC_BLOCK_PREFIXES)) {
    const source = read(file);
    if (source === null) continue;
    for (const found of blankOpeningsIn(source)) blankOpenings.push(`${file}:${found.line}`);
  }

  if (issueRefs.length > 0) {
    report(
      "Issue references found in comments (they need the tracker open to be read -\n" +
        "  keep the reasoning in the comment and the number in the commit):",
      issueRefs
    );
  }
  if (blankOpenings.length > 0) {
    report(
      "Doc blocks opening on an empty line (a folded block shows only its first line -\n" +
        "  start the summary on the `/**` line):",
      blankOpenings
    );
  }
  if (issueRefs.length > 0 || blankOpenings.length > 0) {
    console.error("\n  Fix them and re-run `npm run check:comments`.\n");
    process.exit(1);
  }

  console.log("✓ No issue references in comments, and every doc block opens with its summary");
}
