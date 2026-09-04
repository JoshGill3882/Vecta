// Maintains the CI-owned section of the Definition of Done on the issues a pull
// request closes.
//
// A ticked box is a claim about the code. Boxes ticked by hand go stale the
// moment anything is pushed, so the ones a machine can actually verify are
// owned by CI instead: cleared when a run starts, ticked only by the job that
// proves them.
//
// The fenced block is regenerated wholesale from JOBS below rather than parsed
// and patched. Nothing inside the fence is read, so a hand-edit there cannot
// corrupt the job-to-box mapping — it is simply overwritten. Everything outside
// the fence is human judgement and is never touched.

import { execFileSync } from "node:child_process";

export const START = "<!-- ci:dod:start -->";
export const END = "<!-- ci:dod:end -->";

// The order here is the order the boxes render in. Keys match the `result`
// values passed in via --results.
export const JOBS = [
  { key: "checks", label: "Lint, typecheck and build pass" },
  { key: "test", label: "Test suite passes — no new regressions" },
  { key: "compose", label: "Compose files validate" },
];

function gh(args, input) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    input,
    // The token is supplied by the workflow; inheriting stderr keeps API errors
    // visible in the run log rather than swallowed into a thrown message.
    stdio: ["pipe", "pipe", "inherit"],
  });
}

// GraphQL rather than a regex over the PR body: closingIssuesReferences is what
// GitHub itself resolves "Closes #n" to, including the linked-issue UI, so it
// stays correct when the body is edited or the link is made by hand.
function pullRequest(repo, prNumber) {
  const [owner, name] = repo.split("/");
  const query = `
    query($owner: String!, $name: String!, $pr: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $pr) {
          headRefOid
          closingIssuesReferences(first: 20) {
            nodes { number body }
          }
        }
      }
    }`;
  const out = gh([
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    "-F",
    `owner=${owner}`,
    "-F",
    `name=${name}`,
    "-F",
    `pr=${prNumber}`,
  ]);
  return JSON.parse(out).data.repository.pullRequest;
}

// Two runs for the same pull request can overlap: a job still waiting on its
// dependencies is not yet in a concurrency group, so an older run's update can
// be pending while a newer run clears the boxes. Writing then would tick a box
// for a commit no longer under test. Making the write conditional on still
// being the head is something concurrency alone cannot express.
export function isSuperseded(runSha, headSha) {
  if (!runSha || !headSha) return false;
  return runSha !== headSha;
}

// `results` maps job key to a GitHub job result string. Anything other than
// "success" leaves the box unticked, so a cancelled, failed or skipped job all
// read the same way: unproven.
export function renderBlock(results, sha) {
  const lines = JOBS.map((job) => {
    const ticked = results[job.key] === "success";
    return `- [${ticked ? "x" : " "}] ${job.label}`;
  });

  const provenance = sha
    ? `\n_Maintained by CI. Last updated for commit \`${sha.slice(0, 7)}\`._`
    : "\n_Maintained by CI._";

  return [START, "", ...lines, provenance, "", END].join("\n");
}

// The markers must stand alone on their own line. An issue that *describes* the
// mechanism — "delimited by `<!-- ci:dod:start -->`" — mentions them inline, and
// a plain substring search would treat the first such mention as the real fence
// and overwrite the surrounding prose. Anchoring to a whole line distinguishes
// the fence from any discussion of it.
const START_LINE = /^<!-- ci:dod:start -->[ \t]*$/m;
const END_LINE = /^<!-- ci:dod:end -->[ \t]*$/m;

export function replaceBlock(body, block) {
  const start = body.match(START_LINE);
  if (!start) return null;

  // Search for the closing marker only after the opening one, so a stray END
  // earlier in the body cannot produce an inverted range.
  const tail = body.slice(start.index);
  const end = tail.match(END_LINE);
  if (!end) return null;

  const endsAt = start.index + end.index + end[0].length;
  return body.slice(0, start.index) + block + body.slice(endsAt);
}

export function parseArgs(argv) {
  const args = { reset: false, results: {} };
  for (const arg of argv) {
    if (arg === "--reset") args.reset = true;
    else if (arg.startsWith("--results=")) {
      // e.g. --results=checks:success,test:failure
      for (const pair of arg.slice("--results=".length).split(",")) {
        if (!pair) continue;
        const [key, value] = pair.split(":");
        args.results[key] = value;
      }
    }
  }
  return args;
}

function main() {
  const { GITHUB_REPOSITORY: repo, PR_NUMBER: pr, HEAD_SHA: sha } = process.env;
  if (!repo || !pr) {
    console.error("GITHUB_REPOSITORY and PR_NUMBER are required");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  // --reset clears every box by supplying no results at all.
  const results = args.reset ? {} : args.results;

  const { headRefOid, closingIssuesReferences } = pullRequest(repo, Number(pr));

  if (isSuperseded(sha, headRefOid)) {
    console.log(
      `Run is for ${sha?.slice(0, 7)}, head is now ${headRefOid?.slice(0, 7)} — skipping.`
    );
    return;
  }

  const issues = closingIssuesReferences.nodes;
  if (issues.length === 0) {
    // A PR that closes no issue is a normal state, not an error.
    console.log("No linked issues — nothing to update.");
    return;
  }

  for (const issue of issues) {
    const body = issue.body ?? "";
    const updated = replaceBlock(body, renderBlock(results, sha));

    if (updated === null) {
      // An issue predating the fenced templates, or one whose markers were
      // removed. Left alone rather than guessed at.
      console.log(`#${issue.number}: no CI-owned section, skipped.`);
      continue;
    }
    if (updated === body) {
      console.log(`#${issue.number}: already up to date.`);
      continue;
    }

    gh(["issue", "edit", String(issue.number), "--repo", repo, "--body-file", "-"], updated);
    console.log(`#${issue.number}: CI-owned Definition of Done updated.`);
  }
}

// Only runs when invoked as a script. Importing the module (as the tests do)
// exercises the pure functions without touching the GitHub API.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
