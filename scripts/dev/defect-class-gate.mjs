#!/usr/bin/env node

// Defect-class repair gate.
//
// Between 2026-08-10 and 2026-08-13 this project merged 39 `fix:` commits against 15 features,
// with zero reverts. Nothing was undone; the same defect class was simply repaired one site at a
// time. `scripts/complete-delivery-adapter.mjs` took 14 commits in a single day and grew 20%
// while the path it exists to serve still did not work, and three separate pull requests — 87,
// 88, and 96 in the Founder Command Center — each fixed one instance of "the worker cannot see
// something it needs". A fourth pair, 55 and 61, fixed two shapes of one shortcut defect 17
// hours apart; the second pull request's own body records that the first had covered only part
// of it.
//
// The governing principle already existed. `docs/governance/worker-reasoning-framework-and-
// cognitive-identity.md` principle 2 is "Understanding before expansion: do not increase
// complexity beyond the ability to inspect, test, govern, and remove it." It was loaded into
// every operator session throughout, and it did not bind, because nothing in a repair loop ever
// forced the question to be asked out loud.
//
// So this gate does not ask for good intentions. It requires every `fix:` commit to name the
// defect class it belongs to and to record where else on the path that class was looked for.
// A mechanical check cannot make the analysis correct — it can only force it to happen, put it
// in permanent history where a reviewer can challenge it, and make skipping it visible. That
// limit is stated plainly in the policy document rather than papered over.
//
// The script has no dependencies so the Founder Command Center, which has no CI at all, can
// adopt it by copying one file.

import { execFileSync } from "node:child_process";

const VERDICTS = new Set(["fixed", "clear", "follow-up"]);
const FIX_SUBJECT = /^fix(\([^)]*\))?!?:/u;
const REVERT_SUBJECT = /^revert\b/iu;
const DEFECT_CLASS_LINE = /^Defect-class:[ \t]*(?<value>.*)$/u;
const CLASS_SCAN_LINE = /^Class-scan:[ \t]*(?<value>.*)$/u;

const USAGE = `Usage: node scripts/dev/defect-class-gate.mjs [--base <revision>] [--json]

Validates that every \`fix:\` commit in <base>..HEAD carries a defect-class record:

  Defect-class: <the class of defect, not this one instance>
  Class-scan: fixed | <path> [note]
  Class-scan: clear | <path> [note]
  Class-scan: follow-up | <path to a task record> [note]

Rules:
  - exactly one Defect-class line, non-empty;
  - at least one Class-scan line;
  - every Class-scan verdict is one of: fixed, clear, follow-up;
  - at least one Class-scan path lies outside the commit's own changed paths,
    because a scan that only looks at the file just edited is not a scan;
  - every follow-up path exists at that commit, so a deferral names a real record.

Without --base the range is <merge-base HEAD origin/main>..HEAD, which is empty on main.
Exit codes: 0 pass, 1 violations found, 2 the range could not be resolved.`;

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function parseArguments(argv) {
  const options = { base: undefined, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--base") {
      index += 1;
      if (index >= argv.length) throw new Error("--base requires a revision");
      options.base = argv[index];
    } else if (argument.startsWith("--base=")) {
      options.base = argument.slice("--base=".length);
    } else throw new Error(`Unrecognized argument: ${argument}`);
  }
  return options;
}

function resolveBase(explicit) {
  if (explicit !== undefined) {
    try {
      return git(["rev-parse", "--verify", `${explicit}^{commit}`]).trim();
    } catch {
      throw new Error(`Base revision could not be resolved: ${explicit}`);
    }
  }
  try {
    return git(["merge-base", "HEAD", "origin/main"]).trim();
  } catch {
    throw new Error(
      "No --base was given and 'git merge-base HEAD origin/main' failed. " +
        "Pass --base explicitly; in CI use the pull request's base SHA. " +
        "A shallow checkout is the usual cause: set fetch-depth: 0.",
    );
  }
}

// The site is the first whitespace-delimited token so it stays machine-comparable against the
// commit's changed paths. Anything after it is a free-text note for the reviewer.
function parseClassScan(value) {
  const separator = value.indexOf("|");
  if (separator === -1) return { error: `missing "|" separator in Class-scan: ${value}` };
  const verdict = value.slice(0, separator).trim();
  const remainder = value.slice(separator + 1).trim();
  if (!VERDICTS.has(verdict))
    return {
      error: `unknown Class-scan verdict "${verdict}" (expected fixed, clear, or follow-up)`,
    };
  if (remainder.length === 0) return { error: `Class-scan "${verdict}" names no path` };
  const [site] = remainder.split(/\s+/u);
  return { verdict, site };
}

function commitExists(sha, path) {
  try {
    git(["cat-file", "-e", `${sha}:${path}`], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function inspectCommit(sha) {
  const body = git(["show", "-s", "--format=%B", sha]);
  const lines = body.split("\n");
  const subject = (lines[0] ?? "").trim();
  if (!FIX_SUBJECT.test(subject) || REVERT_SUBJECT.test(subject))
    return { sha, subject, checked: false, violations: [] };

  const changedPaths = new Set(
    git(["show", "--name-only", "--pretty=format:", sha])
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

  const defectClasses = [];
  const scans = [];
  const violations = [];
  for (const line of lines.slice(1)) {
    const declared = DEFECT_CLASS_LINE.exec(line);
    if (declared?.groups) {
      defectClasses.push(declared.groups.value.trim());
      continue;
    }
    const scan = CLASS_SCAN_LINE.exec(line);
    if (scan?.groups) {
      const parsed = parseClassScan(scan.groups.value.trim());
      if (parsed.error) violations.push(parsed.error);
      else scans.push(parsed);
    }
  }

  if (defectClasses.length === 0)
    violations.push("no Defect-class line — name the class of defect, not this one instance");
  else if (defectClasses.length > 1)
    violations.push(
      `${String(defectClasses.length)} Defect-class lines — a commit repairs exactly one class`,
    );
  else if (defectClasses[0].length === 0) violations.push("the Defect-class line is empty");

  if (scans.length === 0)
    violations.push("no Class-scan line — record where else on this path the class was looked for");

  const elsewhere = scans.some((scan) => !changedPaths.has(scan.site));
  if (scans.length > 0 && !elsewhere)
    violations.push(
      "every Class-scan path is a file this commit already changed — " +
        "a scan that only looks at the edited files is not a scan",
    );

  for (const scan of scans)
    if (scan.verdict === "follow-up" && !commitExists(sha, scan.site))
      violations.push(`follow-up path does not exist at this commit: ${scan.site}`);

  return { sha, subject, checked: true, violations };
}

function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${String(error.message)}\n\n${USAGE}\n`);
    return 2;
  }
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  let base;
  try {
    base = resolveBase(options.base);
  } catch (error) {
    process.stderr.write(`${String(error.message)}\n`);
    return 2;
  }

  const shas = git(["rev-list", "--no-merges", `${base}..HEAD`])
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const results = shas.map((sha) => inspectCommit(sha));
  const checked = results.filter((result) => result.checked);
  const failing = checked.filter((result) => result.violations.length > 0);

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          base,
          commits: shas.length,
          repairCommits: checked.length,
          failing: failing.map((result) => ({
            sha: result.sha,
            subject: result.subject,
            violations: result.violations,
          })),
        },
        null,
        2,
      )}\n`,
    );
    return failing.length > 0 ? 1 : 0;
  }

  if (failing.length === 0) {
    process.stdout.write(
      `Defect-class gate: ${String(checked.length)} repair commit(s) of ${String(shas.length)} checked against ${base.slice(0, 12)}; all carry a defect-class record.\n`,
    );
    return 0;
  }

  process.stderr.write(
    `Defect-class gate failed for ${String(failing.length)} of ${String(checked.length)} repair commit(s).\n\n`,
  );
  for (const result of failing) {
    process.stderr.write(`  ${result.sha.slice(0, 12)}  ${result.subject}\n`);
    for (const violation of result.violations) process.stderr.write(`      - ${violation}\n`);
    process.stderr.write("\n");
  }
  process.stderr.write(
    "Amend each commit message to record the defect class and the scan. See\n" +
      "docs/governance/defect-class-repair-gate.md for the format and the reasoning.\n",
  );
  return 1;
}

process.exitCode = main();
