// Prune old `main-<sha>` image versions from GHCR.
//
// Every push to the long-lived branch publishes an immutable `main-<sha>`
// alongside the moving `:unstable`, and GHCR applies no retention to tagged
// versions. Left alone they accumulate for the life of the project, each
// holding its layers alive and each with a cosign signature entry beside it.
//
// ── Why this is not `actions/delete-package-versions` ───────────────────────
//
// The obvious recipe — delete untagged versions, keep the most recent N tagged
// — destroys published releases here. A multi-arch publish produces eight
// versions, and six of them are untagged:
//
//   main-<sha>, :unstable               the index the tag resolves to
//     ├── linux/amd64                   UNTAGGED, referenced by the index
//     ├── linux/arm64                   UNTAGGED, referenced by the index
//     ├── attestation (unknown/unknown) UNTAGGED, referenced by the index
//     └── attestation (unknown/unknown) UNTAGGED, referenced by the index
//   <per-arch build index> x2           UNTAGGED, referenced by nothing
//   sha256-<digest>.sig                 the cosign signature
//
// Four of those untagged versions are the image. Deleting them leaves the tag
// listed and unpullable — including `:latest` and every `v*` release.
//
// ── What this does instead ─────────────────────────────────────────────────
//
// Mark and sweep, which gets the shared cases right without enumerating them.
//
//   MARK   Every protected tag (`:unstable`, `:latest`, any `v*`) and the N
//          most recent `main-<sha>` are roots. Walk each root's manifest and
//          mark everything reachable from it, plus its signature.
//   SWEEP  Delete `main-<sha>` versions past the keep count, their
//          signatures, and any untagged version nothing marked.
//
// Reachability is the safety property. A manifest shared between two builds is
// marked while either survives, with no special case. An orphaned per-arch
// build index is unreachable and goes, without needing to know it exists.
//
// The sweep is only sound if the mark phase was complete, so **any failure to
// read any root aborts the whole run before deleting anything**. A half-built
// reachable set makes live manifests look like garbage, which is the one way
// this script could destroy a release.
//
// Run: npm run prune:ghcr            (dry run — reports, deletes nothing)
//      npm run prune:ghcr -- --delete

const REGISTRY = "ghcr.io";
const OWNER = process.env.GHCR_OWNER ?? "JoshGill3882";
const PACKAGE = process.env.GHCR_PACKAGE ?? "vecta";
const IMAGE = `${OWNER}/${PACKAGE}`.toLowerCase();

// Tags that must never be pruned, whatever their age.
export const PROTECTED_TAGS = ["unstable", "latest"];
export const PROTECTED_TAG_PATTERN = /^v\d/;
// Matches the per-commit tag published for a push to the long-lived branch.
//
// Two prefixes, because a published version keeps whatever prefix was current
// when it was built, and the branch has been renamed. Matching only the newer
// one would push every older version down `classify`'s "unrecognised tag is not
// ours to delete" path, which protects it for ever — the retention job would
// quietly stop reclaiming exactly the versions it exists to reclaim.
export const BRANCH_BUILD_TAG_PATTERN = /^(?:main|develop)-[0-9a-f]{7,40}$/;
export const SIGNATURE_TAG_PATTERN = /^sha256-([0-9a-f]{64})\.sig$/;

// How many `main-<sha>` builds to keep.
//
// Ten, because the point of an immutable per-commit tag is that "it broke on
// unstable" stays reproducible and a regression stays bisectable. Ten covers
// roughly the last fortnight at this project's merge rate, which is longer than
// a dev build survives being interesting — nobody bisects an `:unstable`
// regression against a build from last month, because `:unstable` has moved
// dozens of times since.
//
// It is a retention window, not a storage budget. Raise it if bisects start
// running off the end; there is no cost here beyond a longer listing.
export const DEFAULT_KEEP = 10;

function parseArgs(argv) {
  const args = { keep: DEFAULT_KEEP, dryRun: true };
  for (const a of argv) {
    if (a === "--delete") args.dryRun = false;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a.startsWith("--keep=")) {
      const n = Number(a.slice("--keep=".length));
      if (!Number.isInteger(n) || n < 1)
        throw new Error(`--keep must be a positive integer, got ${a}`);
      args.keep = n;
    } else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
  }
  return args;
}

/** Split the version list into the categories the sweep reasons about. */
export function classify(versions) {
  const protectedIdx = [];
  const branchBuilds = [];
  const signatures = new Map(); // signed digest -> version
  const untagged = [];

  for (const v of versions) {
    const tags = v.metadata?.container?.tags ?? [];
    if (tags.length === 0) {
      untagged.push(v);
      continue;
    }
    const sig = tags.map((t) => SIGNATURE_TAG_PATTERN.exec(t)).find(Boolean);
    if (sig) {
      signatures.set(`sha256:${sig[1]}`, v);
      continue;
    }
    const isProtected = tags.some(
      (t) => PROTECTED_TAGS.includes(t) || PROTECTED_TAG_PATTERN.test(t)
    );
    if (isProtected) protectedIdx.push(v);
    else if (tags.some((t) => BRANCH_BUILD_TAG_PATTERN.test(t))) branchBuilds.push(v);
    else protectedIdx.push(v); // an unrecognised tag is not ours to delete
  }
  return { protectedIdx, branchBuilds, signatures, untagged };
}

/**
 * Which `main-<sha>` versions to keep, newest first. A version carrying a
 * protected tag as well (the newest usually also holds `:unstable`) has already
 * been classified as protected, so it never reaches here.
 */
export function selectBranchBuildsToPrune(branchBuilds, keep) {
  const sorted = [...branchBuilds].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return { keep: sorted.slice(0, keep), prune: sorted.slice(keep) };
}

async function gh(path, options = {}) {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GH_TOKEN or GITHUB_TOKEN must be set");
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(
      `GitHub API ${options.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`
    );
  }
  return res.status === 204 ? null : res.json();
}

/** Every version of the package, following pagination to the end. */
async function listVersions() {
  const out = [];
  for (let page = 1; ; page++) {
    const batch = await gh(
      `/users/${OWNER}/packages/container/${PACKAGE}/versions?per_page=100&page=${page}`
    );
    out.push(...batch);
    if (batch.length < 100) return out;
  }
}

let registryToken = null;
async function registryAuth() {
  if (registryToken) return registryToken;
  const res = await fetch(
    `https://${REGISTRY}/token?scope=repository:${IMAGE}:pull&service=${REGISTRY}`
  );
  if (!res.ok) throw new Error(`registry auth → ${res.status}`);
  registryToken = (await res.json()).token;
  return registryToken;
}

const ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(",");

async function fetchManifest(reference) {
  const token = await registryAuth();
  const res = await fetch(`https://${REGISTRY}/v2/${IMAGE}/manifests/${reference}`, {
    headers: { authorization: `Bearer ${token}`, accept: ACCEPT },
  });
  if (!res.ok) throw new Error(`manifest ${reference} → ${res.status}`);
  return res.json();
}

/**
 * Mark everything reachable from `roots`, following index → manifest edges.
 *
 * Throws rather than skipping on any read failure. The sweep treats "unmarked"
 * as "delete", so an incomplete mark set is indistinguishable from a large pile
 * of garbage — exactly the mistake that would take a release with it.
 */
export async function markReachable(roots, fetchFn = fetchManifest) {
  const marked = new Set();
  const queue = [...roots];
  while (queue.length) {
    const digest = queue.pop();
    if (marked.has(digest)) continue;
    marked.add(digest);
    const manifest = await fetchFn(digest);
    for (const child of manifest.manifests ?? []) {
      if (child.digest && !marked.has(child.digest)) queue.push(child.digest);
    }
  }
  return marked;
}

function describe(v) {
  const tags = v.metadata?.container?.tags ?? [];
  return `${v.name.slice(0, 19)}… ${tags.length ? `[${tags.join(", ")}]` : "(untagged)"} ${v.created_at.slice(0, 10)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const versions = await listVersions();
  const { protectedIdx, branchBuilds, signatures, untagged } = classify(versions);
  const { keep, prune } = selectBranchBuildsToPrune(branchBuilds, args.keep);

  console.log(`Package ${IMAGE} — ${versions.length} versions`);
  console.log(
    `  ${protectedIdx.length} protected, ${branchBuilds.length} branch builds, ` +
      `${signatures.size} signatures, ${untagged.length} untagged\n`
  );

  // MARK. Roots are everything that must survive.
  const roots = [...protectedIdx, ...keep].map((v) => v.name);
  let marked;
  try {
    marked = await markReachable(roots);
  } catch (err) {
    console.error(
      `✗ Aborting without deleting anything: could not read the full manifest ` +
        `graph.\n  ${err.message}\n\n  The sweep deletes whatever it could not ` +
        `reach, so an incomplete walk would delete live images.`
    );
    process.exit(1);
  }
  console.log(`Marked ${marked.size} manifests reachable from ${roots.length} protected roots.`);

  // SWEEP.
  const doomed = [];
  for (const v of prune) {
    doomed.push({ v, why: "branch build past the keep count" });
    const sig = signatures.get(v.name);
    if (sig) doomed.push({ v: sig, why: "signature of a pruned build" });
  }
  for (const v of untagged) {
    if (!marked.has(v.name)) doomed.push({ v, why: "unreferenced by any protected tag" });
  }
  // A signature whose subject is gone is dangling whether or not we pruned it.
  for (const [digest, sig] of signatures) {
    if (!marked.has(digest) && !doomed.some((d) => d.v.id === sig.id)) {
      doomed.push({ v: sig, why: "signature with no surviving subject" });
    }
  }

  console.log(`\nKeeping ${keep.length} of ${branchBuilds.length} branch builds:`);
  for (const v of keep) console.log(`  keep   ${describe(v)}`);
  console.log(`\nProtected, never pruned:`);
  for (const v of protectedIdx) console.log(`  keep   ${describe(v)}`);

  if (doomed.length === 0) {
    console.log(`\n✓ Nothing to prune.`);
    return;
  }

  console.log(`\n${doomed.length} version(s) to delete:`);
  for (const { v, why } of doomed) console.log(`  delete ${describe(v)}  — ${why}`);

  // A last assertion before anything irreversible: nothing protected, and
  // nothing reachable from something protected, may be in the list.
  const protectedIds = new Set([...protectedIdx, ...keep].map((v) => v.id));
  for (const { v } of doomed) {
    if (protectedIds.has(v.id) || marked.has(v.name)) {
      console.error(`\n✗ Refusing to run: ${describe(v)} is protected or still referenced.`);
      process.exit(1);
    }
  }

  if (args.dryRun) {
    console.log(`\nDry run — nothing was deleted. Re-run with --delete to apply.`);
    return;
  }

  // The run log is the only record of what was deleted, so a failure partway
  // through must not throw away the account of what already succeeded.
  //
  // An auth failure stops the run: the token cannot delete, so the remaining
  // attempts would each fail the same way and bury the one error that matters
  // under sixty copies. Anything else is treated as possibly transient — the
  // rest are attempted, and the exit code reports that some did not go.
  const deleted = [];
  const failed = [];
  for (const { v, why } of doomed) {
    try {
      await gh(`/users/${OWNER}/packages/container/${PACKAGE}/versions/${v.id}`, {
        method: "DELETE",
      });
      deleted.push(v);
      console.log(`  deleted ${describe(v)}  — ${why}`);
    } catch (err) {
      failed.push({ v, err });
      console.error(`  FAILED  ${describe(v)}  — ${err.message}`);
      if (/→ 40[13]/.test(err.message)) {
        console.error(
          `\n✗ Stopping: the token cannot delete package versions. ` +
            `It needs the \`delete:packages\` and \`read:packages\` scopes.`
        );
        break;
      }
    }
  }

  console.log(`\nDeleted ${deleted.length} of ${doomed.length} version(s).`);
  if (failed.length) {
    console.error(`${failed.length} deletion(s) failed; nothing else was changed.`);
    process.exit(1);
  }
  console.log(`✓ Done.`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
}
