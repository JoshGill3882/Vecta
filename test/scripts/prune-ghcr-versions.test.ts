import { describe, it, expect, vi } from "vitest";

// Pure functions — no API, no registry. The module guards its own main() so
// importing it here never reaches for either.
import {
  classify,
  selectBranchBuildsToPrune,
  markReachable,
  PROTECTED_TAGS,
  PROTECTED_TAG_PATTERN,
  BRANCH_BUILD_TAG_PATTERN,
  SIGNATURE_TAG_PATTERN,
  DEFAULT_KEEP,
} from "@/scripts/prune-ghcr-versions.mjs";

type Version = {
  id: number;
  name: string;
  created_at: string;
  metadata?: { container?: { tags?: string[] } };
};

let nextId = 1;
/** Builds a GHCR package version fixture.
 *
 * @param name The version name, which the API reports as the digest.
 * @param tags Tags pointing at it; an untagged version is a prune candidate.
 * @param created_at When it was pushed, which the age cutoff reads.
 * @returns One version as the API would return it.
 */
function version(name: string, tags: string[], created_at = "2026-09-01T00:00:00Z"): Version {
  return { id: nextId++, name, created_at, metadata: { container: { tags } } };
}

describe("tag patterns", () => {
  it("recognises the tags that must never be pruned", () => {
    expect(PROTECTED_TAGS).toContain("unstable");
    expect(PROTECTED_TAGS).toContain("latest");
    for (const t of ["v1.0.0", "v1.0.0-rc1", "v2.10.3"]) {
      expect(PROTECTED_TAG_PATTERN.test(t)).toBe(true);
    }
  });

  it("does not mistake a branch build tag for a version tag", () => {
    expect(PROTECTED_TAG_PATTERN.test("main-80747c8")).toBe(false);
    expect(BRANCH_BUILD_TAG_PATTERN.test("main-80747c8")).toBe(true);
    expect(BRANCH_BUILD_TAG_PATTERN.test("main-notahex")).toBe(false);
  });

  // A published version keeps the prefix that was current when it was built,
  // and the branch has been renamed. Matching only the newer prefix would send
  // every older version down the "unrecognised tag" path, which protects it for
  // ever — the retention job would silently stop reclaiming anything older than
  // the rename.
  it("still recognises builds published under the previous branch name", () => {
    expect(BRANCH_BUILD_TAG_PATTERN.test("develop-80747c8")).toBe(true);
    expect(BRANCH_BUILD_TAG_PATTERN.test("develop-notahex")).toBe(false);
  });

  it("does not match a prefix that is neither", () => {
    expect(BRANCH_BUILD_TAG_PATTERN.test("feature-80747c8")).toBe(false);
    expect(BRANCH_BUILD_TAG_PATTERN.test("80747c8")).toBe(false);
  });

  it("extracts the signed digest from a cosign signature tag", () => {
    const digest = "a".repeat(64);
    expect(SIGNATURE_TAG_PATTERN.exec(`sha256-${digest}.sig`)?.[1]).toBe(digest);
    expect(SIGNATURE_TAG_PATTERN.exec("main-80747c8")).toBeNull();
  });
});

describe("classify", () => {
  it("sorts each version into the bucket the sweep reasons about", () => {
    const digest = "b".repeat(64);
    const result = classify([
      version("sha256:1", ["latest", "v1.0.0"]),
      version("sha256:2", ["main-80747c8", "unstable"]),
      version("sha256:3", ["main-5d17230"]),
      version(`sha256:${digest}`, [`sha256-${digest}.sig`]),
      version("sha256:5", []),
    ]);
    expect(result.protectedIdx.map((v) => v.name)).toEqual(["sha256:1", "sha256:2"]);
    expect(result.branchBuilds.map((v) => v.name)).toEqual(["sha256:3"]);
    expect(result.untagged.map((v) => v.name)).toEqual(["sha256:5"]);
    expect(result.signatures.has(`sha256:${digest}`)).toBe(true);
  });

  // A branch build that also carries :unstable is the newest one. It must be
  // protected by the tag, not left eligible because of its per-commit tag.
  it("protects a branch build that also carries a protected tag", () => {
    const { protectedIdx, branchBuilds } = classify([
      version("sha256:1", ["main-abc1234", "unstable"]),
    ]);
    expect(protectedIdx).toHaveLength(1);
    expect(branchBuilds).toHaveLength(0);
  });

  // Fail safe: something this script does not recognise is not its to delete.
  it("treats an unrecognised tag as protected rather than prunable", () => {
    const { protectedIdx, branchBuilds } = classify([version("sha256:1", ["experimental"])]);
    expect(protectedIdx).toHaveLength(1);
    expect(branchBuilds).toHaveLength(0);
  });

  // Versions published either side of the branch rename are one pool, ordered
  // by age. If the older prefix were not classified here it would be protected
  // instead, and would never be reclaimed.
  it("pools builds from both branch names into one bucket", () => {
    const { protectedIdx, branchBuilds } = classify([
      version("sha256:1", ["develop-abc1234"]),
      version("sha256:2", ["main-def5678"]),
    ]);
    expect(branchBuilds.map((v) => v.name)).toEqual(["sha256:1", "sha256:2"]);
    expect(protectedIdx).toHaveLength(0);
  });
});

describe("selectBranchBuildsToPrune", () => {
  // Deliberately mixed prefixes: the older build predates the branch rename,
  // and age is the only thing that decides what goes.
  const builds = [
    version("sha256:old", ["develop-1111111"], "2026-01-01T00:00:00Z"),
    version("sha256:new", ["main-3333333"], "2026-03-01T00:00:00Z"),
    version("sha256:mid", ["main-2222222"], "2026-02-01T00:00:00Z"),
  ];

  it("keeps the most recent N by creation date, whatever order they arrived in", () => {
    const { keep, prune } = selectBranchBuildsToPrune(builds, 2);
    expect(keep.map((v) => v.name)).toEqual(["sha256:new", "sha256:mid"]);
    expect(prune.map((v) => v.name)).toEqual(["sha256:old"]);
  });

  it("prunes nothing when there are fewer builds than the keep count", () => {
    expect(selectBranchBuildsToPrune(builds, 10).prune).toEqual([]);
    expect(selectBranchBuildsToPrune([], DEFAULT_KEEP).prune).toEqual([]);
  });

  it("does not mutate the list it was given", () => {
    const order = builds.map((v) => v.name);
    selectBranchBuildsToPrune(builds, 1);
    expect(builds.map((v) => v.name)).toEqual(order);
  });
});

describe("markReachable", () => {
  // The shape a multi-arch publish actually produces: a tagged index over two
  // platform manifests and two provenance attestations.
  const graph: Record<string, { manifests?: { digest: string }[] }> = {
    "sha256:index": {
      manifests: [
        { digest: "sha256:amd64" },
        { digest: "sha256:arm64" },
        { digest: "sha256:att1" },
        { digest: "sha256:att2" },
      ],
    },
    "sha256:amd64": {},
    "sha256:arm64": {},
    "sha256:att1": {},
    "sha256:att2": {},
    "sha256:orphan": { manifests: [{ digest: "sha256:amd64" }] },
  };
  const fake = async (d: string) => {
    if (!(d in graph)) throw new Error(`manifest ${d} → 404`);
    return graph[d];
  };

  it("marks an index and everything it points at", async () => {
    const marked = await markReachable(["sha256:index"], fake);
    expect([...marked].sort()).toEqual([
      "sha256:amd64",
      "sha256:arm64",
      "sha256:att1",
      "sha256:att2",
      "sha256:index",
    ]);
  });

  // The whole reason this is reachability rather than "delete this index's
  // children": a manifest shared with a surviving build must stay marked.
  it("marks a manifest shared by two roots exactly once", async () => {
    const fetchFn = vi.fn(fake);
    const marked = await markReachable(["sha256:index", "sha256:orphan"], fetchFn);
    expect(marked.has("sha256:amd64")).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(6); // 6 distinct nodes, none re-fetched
  });

  it("leaves an unreferenced orphan unmarked when it is not a root", async () => {
    const marked = await markReachable(["sha256:index"], fake);
    expect(marked.has("sha256:orphan")).toBe(false);
  });

  // The most important test here. The sweep deletes whatever is unmarked, so a
  // read failure that returned a partial set would delete live images.
  it("throws rather than returning a partial set when a manifest cannot be read", async () => {
    await expect(markReachable(["sha256:index", "sha256:missing"], fake)).rejects.toThrow(
      /manifest sha256:missing/
    );
  });

  it("terminates on a cycle rather than looping forever", async () => {
    const cyclic: Record<string, { manifests?: { digest: string }[] }> = {
      "sha256:a": { manifests: [{ digest: "sha256:b" }] },
      "sha256:b": { manifests: [{ digest: "sha256:a" }] },
    };
    const marked = await markReachable(["sha256:a"], async (d: string) => cyclic[d]);
    expect([...marked].sort()).toEqual(["sha256:a", "sha256:b"]);
  });
});
