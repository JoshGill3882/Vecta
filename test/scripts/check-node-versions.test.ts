import { describe, it, expect } from "vitest";

// Pure functions — no filesystem, no docker. The module guards its own main()
// so importing it here never shells out.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseDockerfileTags,
  parseWorkflowVersions,
  majorOf,
  checkAgreement,
  workflowFiles,
} from "../../scripts/check-node-versions.mjs";

const dockerfile = [
  "# Node 24 (Krypton), the active LTS.",
  "FROM node:24-alpine AS deps",
  "RUN apk add --no-cache python3 make g++",
  "",
  "FROM node:24-alpine AS builder",
  "COPY --from=deps /app/node_modules ./node_modules",
  "",
  "FROM node:24-alpine AS runner",
].join("\n");

const workflow = [
  "      - uses: actions/setup-node@v4",
  "        with:",
  "          node-version: 24",
  "          cache: npm",
].join("\n");

describe("parseDockerfileTags", () => {
  it("finds the tag from every stage, in file order", () => {
    expect(parseDockerfileTags(dockerfile)).toEqual(["24-alpine", "24-alpine", "24-alpine"]);
  });

  it("ignores `node:` appearing anywhere but a FROM instruction", () => {
    const text = ["# see node:lts-alpine for why", "FROM node:24-alpine AS deps"].join("\n");
    expect(parseDockerfileTags(text)).toEqual(["24-alpine"]);
  });

  it("returns nothing when the Dockerfile is not Node-based", () => {
    expect(parseDockerfileTags("FROM alpine:3.20\nRUN echo hi")).toEqual([]);
  });
});

describe("parseWorkflowVersions", () => {
  it("reads an unquoted value", () => {
    expect(parseWorkflowVersions(workflow)).toEqual(["24"]);
  });

  it("reads quoted values, which YAML allows for a version-like string", () => {
    expect(parseWorkflowVersions(`          node-version: "24.21.0"`)).toEqual(["24.21.0"]);
    expect(parseWorkflowVersions(`          node-version: '22'`)).toEqual(["22"]);
  });

  it("stops at a trailing comment rather than swallowing it", () => {
    expect(parseWorkflowVersions("          node-version: 24 # LTS")).toEqual(["24"]);
  });
});

describe("workflowFiles", () => {
  // Listing the directory rather than naming the workflows is the point: a
  // workflow added later is exactly where a stale pin would otherwise hide.
  it("finds every workflow and ignores anything that is not one", () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-"));
    for (const name of ["ci.yml", "_test.yml", "deploy.yaml", "README.md", "notes.txt"]) {
      writeFileSync(join(dir, name), "");
    }
    expect(workflowFiles(dir).map((p: string) => p.split("/").pop())).toEqual([
      "_test.yml",
      "ci.yml",
      "deploy.yaml",
    ]);
  });
});

describe("majorOf", () => {
  it("reads a major from every shape a Node version is written in", () => {
    expect(majorOf("24-alpine")).toBe(24);
    expect(majorOf("24")).toBe(24);
    expect(majorOf("v24.21.0")).toBe(24);
    expect(majorOf(">=24")).toBe(24);
  });

  it("refuses a floating tag, which names no version at all", () => {
    expect(majorOf("lts")).toBeNull();
    expect(majorOf("latest")).toBeNull();
    expect(majorOf("lts-alpine")).toBeNull();
  });
});

describe("checkAgreement", () => {
  const agreed = {
    dockerfileTags: ["24-alpine", "24-alpine"],
    workflowVersions: ["24", "24"],
    enginesRange: ">=24",
    runtimeVersion: "v24.21.0",
  };

  it("passes when every pin names the same major", () => {
    const result = checkAgreement(agreed);
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.major).toBe(24);
  });

  it("passes when the image runtime agrees too", () => {
    const result = checkAgreement({ ...agreed, imageVersion: "v24.21.0" });
    expect(result.ok).toBe(true);
    expect(result.major).toBe(24);
  });

  // The exact drift this guard exists to stop: CI left behind on an EOL major
  // while the image moved on.
  it("fails when a workflow is left behind on an older major", () => {
    const result = checkAgreement({ ...agreed, workflowVersions: ["24", "20"] });
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toContain("disagrees across 2 values (20, 24)");
  });

  it("fails when the image runs a different major from the runner", () => {
    const result = checkAgreement({ ...agreed, imageVersion: "v20.20.2" });
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toContain("the base image runtime (v20.20.2)");
  });

  it("fails on a floating base tag even when every named major agrees", () => {
    const result = checkAgreement({ ...agreed, dockerfileTags: ["lts-alpine", "24-alpine"] });
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toContain("is a floating tag");
  });

  it("names every disagreeing source, so one run reports all of them", () => {
    const result = checkAgreement({
      ...agreed,
      workflowVersions: ["20", "22"],
      enginesRange: ">=24",
    });
    expect(result.ok).toBe(false);
    const report = result.problems.join("\n");
    expect(report).toContain("workflow node-version: 20");
    expect(report).toContain("workflow node-version: 22");
    expect(report).toContain("package.json engines.node (>=24)");
    expect(result.major).toBeNull();
  });
});
