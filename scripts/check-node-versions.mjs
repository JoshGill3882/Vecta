// Guard: every place that names a Node version must name the same one.
//
// Four files pin a Node version independently — the Dockerfile (once per stage),
// ci.yml, _test.yml and the `engines.node` range in package.json. Nothing tied
// them together, and they drifted: CI sat on Node 20 long after it went
// end-of-life while the image tracked `node:lts-alpine`, which silently became
// Node 24 the moment 24 entered LTS. The suite was proven on one major and the
// container shipped another, with no commit marking the change.
//
// Two rules follow, and this script enforces both:
//
//   1. No floating base tags. `lts`, `latest` and `current` all move on their
//      own, so an image built from them can change major version with no commit
//      to point at. The Dockerfile must name a major.
//   2. Every pin agrees, and the runtime actually running this script agrees
//      with them. With `--with-image` the base image is run as well, so the
//      comparison is between two Node processes that really started, rather
//      than between two strings read out of two files.
//
// Run: `npm run check:node` (static) — CI adds `--with-image`.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Tags that resolve to "whatever is newest", which is the thing rule 1 forbids.
const FLOATING_TAGS = ["lts", "latest", "current", "lts-slim", "lts-alpine"];

export const SOURCES = {
  dockerfile: "Dockerfile",
  // Every workflow, not a list of the two that pin a version today. A third one
  // added later would otherwise be the one place drift could still hide.
  workflowDir: ".github/workflows",
  manifest: "package.json",
};

/** Every workflow file, so none can be added later and escape the check. */
export function workflowFiles(dir = SOURCES.workflowDir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort()
    .map((f) => join(dir, f));
}

/** Every `FROM node:<tag>` in a Dockerfile, in file order. */
export function parseDockerfileTags(text) {
  return [...text.matchAll(/^FROM\s+node:(\S+)/gm)].map((m) => m[1]);
}

/** Every `node-version:` value in a workflow, as written (quotes stripped). */
export function parseWorkflowVersions(text) {
  return [...text.matchAll(/^\s*node-version:\s*["']?([^"'\s#]+)/gm)].map((m) => m[1]);
}

/**
 * The major from anything that names one: "24-alpine", "24.21.0", "v24.21.0",
 * ">=24". Returns null for a floating tag, which is a failure rather than a
 * version — the caller reports it as one.
 */
export function majorOf(value) {
  if (FLOATING_TAGS.includes(value)) return null;
  const m = /(\d+)/.exec(value);
  return m ? Number(m[1]) : null;
}

/**
 * Compare every pin. Returns the problems found rather than throwing, so the
 * caller can report all of them at once — fixing one mismatch only to be told
 * about the next is a poor way to learn there were three.
 *
 * @param {object} options
 * @param {string[]} options.dockerfileTags Tags from every `FROM node:` stage.
 * @param {string[]} options.workflowVersions Every workflow `node-version:`.
 * @param {string} options.enginesRange The `engines.node` range from package.json.
 * @param {string} options.runtimeVersion `process.version` of the running Node.
 * @param {string | null} [options.imageVersion] `node -v` from inside the base image.
 */
export function checkAgreement({
  dockerfileTags,
  workflowVersions,
  enginesRange,
  runtimeVersion,
  imageVersion = null,
}) {
  const problems = [];

  const floating = dockerfileTags.filter((t) => FLOATING_TAGS.includes(t.replace(/-.*$/, "")));
  for (const tag of floating) {
    problems.push(
      `Dockerfile: \`FROM node:${tag}\` is a floating tag, so the image can change ` +
        `Node major with no commit that says so. Name a major instead, e.g. node:24-alpine.`
    );
  }

  // Everything that claims a major, labelled so a mismatch names its own file.
  const claims = [
    ...dockerfileTags
      .filter((t) => !floating.includes(t))
      .map((t) => ({ where: `Dockerfile (node:${t})`, major: majorOf(t) })),
    ...workflowVersions.map((v) => ({ where: `workflow node-version: ${v}`, major: majorOf(v) })),
    { where: `package.json engines.node (${enginesRange})`, major: majorOf(enginesRange) },
    { where: `the runtime running this check (${runtimeVersion})`, major: majorOf(runtimeVersion) },
  ];
  if (imageVersion) {
    claims.push({
      where: `the base image runtime (${imageVersion})`,
      major: majorOf(imageVersion),
    });
  }

  const known = claims.filter((c) => c.major !== null);
  const majors = [...new Set(known.map((c) => c.major))];
  if (majors.length > 1) {
    problems.push(
      `Node major disagrees across ${majors.length} values (${majors.sort((a, b) => a - b).join(", ")}):\n` +
        known.map((c) => `    ${c.major} — ${c.where}`).join("\n")
    );
  }

  return { ok: problems.length === 0, problems, major: majors.length === 1 ? majors[0] : null };
}

/** `node -v` from inside the base image. Throws if docker cannot run it. */
export function imageNodeVersion(tag) {
  return execFileSync("docker", ["run", "--rm", `node:${tag}`, "node", "-v"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function main() {
  const withImage = process.argv.includes("--with-image");

  const dockerfileTags = parseDockerfileTags(readFileSync(SOURCES.dockerfile, "utf8"));
  const workflowVersions = workflowFiles().flatMap((f) =>
    parseWorkflowVersions(readFileSync(f, "utf8"))
  );
  const enginesRange = JSON.parse(readFileSync(SOURCES.manifest, "utf8")).engines?.node ?? "";

  if (dockerfileTags.length === 0) {
    console.error("✗ No `FROM node:<tag>` found in the Dockerfile — has it been restructured?");
    process.exit(1);
  }
  if (workflowVersions.length === 0) {
    console.error("✗ No `node-version:` found in any workflow — has setup-node been removed?");
    process.exit(1);
  }
  if (!enginesRange) {
    console.error("✗ package.json declares no `engines.node`, so nothing states what is required.");
    process.exit(1);
  }

  let imageVersion = null;
  if (withImage) {
    // Deliberately not wrapped in a try that shrugs: --with-image is a promise
    // that the image half was actually checked. If docker cannot run, the check
    // did not happen, and saying nothing would look exactly like a pass.
    try {
      imageVersion = imageNodeVersion(dockerfileTags[0]);
    } catch (err) {
      console.error(
        `✗ --with-image was requested but the base image could not be run:\n  ${err.message}`
      );
      process.exit(1);
    }
  }

  const { ok, problems, major } = checkAgreement({
    dockerfileTags,
    workflowVersions,
    enginesRange,
    runtimeVersion: process.version,
    imageVersion,
  });

  if (!ok) {
    console.error("✗ Node version pins disagree:\n");
    for (const p of problems) console.error(`  • ${p}\n`);
    process.exit(1);
  }

  const proven = imageVersion
    ? `runner ${process.version}, image ${imageVersion}`
    : `runner ${process.version} (image not checked — pass --with-image)`;
  console.log(`✓ Node ${major} everywhere: ${proven}`);
}

// Only runs when invoked as a script, so the tests can import the pure helpers
// without shelling out to docker.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
