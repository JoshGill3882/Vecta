// Decides whether a pull request changes nothing but documentation, so CI can
// skip the jobs that cannot fail on such a change.
//
// Reads the changed paths from stdin, one per line, and writes
// `docs_only=true` or `docs_only=false` to the file GITHUB_OUTPUT names (or to
// stdout when run by hand).
//
// Every doubt resolves towards running everything. A path that is not plainly
// documentation, an empty list, or a failure to read one all answer false, and
// the jobs that read this output run unless it says exactly "true". Misjudging
// the other way would merge untested code with every check green, so this list
// stays short and literal rather than clever.

import { appendFileSync, readFileSync } from "node:fs";

// Markdown anywhere, and the images the docs embed. Nothing in the app, its
// build or its tests reads either.
export const DOCS = [/\.md$/, /^docs\/images\//];

export function isDocumentation(path) {
  return DOCS.some((pattern) => pattern.test(path));
}

// An empty list is not "only documentation": it is a diff that could not be
// read, or a pull request with nothing in it, and neither is evidence that the
// code is unchanged.
export function isDocsOnly(paths) {
  const changed = paths.map((path) => path.trim()).filter(Boolean);
  return changed.length > 0 && changed.every(isDocumentation);
}

function main() {
  const paths = readFileSync(0, "utf8").split("\n");
  const docsOnly = isDocsOnly(paths);
  const line = `docs_only=${docsOnly}\n`;

  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, line);
  else process.stdout.write(line);

  console.error(
    docsOnly
      ? "Documentation only: the build, typecheck, tests and Compose check are skipped."
      : "Not documentation only: every check runs."
  );
}

// Only runs when invoked as a script, so the tests can import the pure functions.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
