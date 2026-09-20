// Guard: issue references must not leak into code comments.
//
// A comment saying `(#50)` needs the issue tracker open to be understood, so it
// stops working the moment someone reads the file on its own — and it dates the
// comment without explaining the code. The reasoning belongs in the comment; the
// number belongs in the commit that made the change. See docs/guides/comments.md.
//
// Only `app/`, `src/` and `test/` are scanned. Documentation legitimately links
// to issues, and `.github/` is where they are authored.
//
// Run: `npm run check:comments`  (also wired into CI and the husky pre-commit hook)

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Directories holding code, where a reader has no tracker to hand. */
const SCANNED_PREFIXES = ["app/", "src/", "test/"];

/** This guard names the pattern it hunts for, so it does not scan itself. */
const SELF = "scripts/check-no-issue-refs.mjs";

/** Source we author. Data files are skipped: a `#1234` in one is not prose. */
const SCANNED_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/;

/**
 * A `#` and one to four digits, as an issue reference is written.
 *
 * The lookarounds keep it off colours. `#123456` fails because no digit run of
 * four or fewer ends on a word boundary, and `#3b9eff` fails because a digit
 * must not be followed by another hex character. Three-digit shorthand like
 * `#123` would match, and is not used here — the category schema rejects it.
 */
const ISSUE_REF = /(?<![0-9a-fA-F#])#(\d{1,4})\b(?![0-9a-fA-F])/;

/** Every tracked source file in the scanned directories.
 *
 * @returns Repository-relative paths.
 */
function scannedFiles() {
  return execSync("git ls-files", { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((f) => SCANNED_EXT.test(f))
    .filter((f) => f !== SELF)
    .filter((f) => SCANNED_PREFIXES.some((p) => f.startsWith(p)));
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

// Only when run directly, so the exports above stay importable from a spec.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const offenders = [];
  for (const file of scannedFiles()) {
    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue; // unreadable or gone between ls-files and now
    }
    for (const found of issueRefsIn(source)) {
      offenders.push(`${file}:${found.line}: ${found.text}`);
    }
  }

  if (offenders.length > 0) {
    console.error(
      "\n✖ Issue references found in comments (they need the tracker open to be read —\n" +
        "  keep the reasoning in the comment and the number in the commit):\n"
    );
    console.error(offenders.map((o) => "    " + o).join("\n"));
    console.error(
      `\n  ${offenders.length} reference(s). Remove them and re-run \`npm run check:comments\`.\n`
    );
    process.exit(1);
  }

  console.log("✓ No issue references in comments");
}
