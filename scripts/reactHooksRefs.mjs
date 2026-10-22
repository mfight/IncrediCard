// A baseline guard for `react-hooks/refs`, which is OFF in
// eslint.config.mjs because its current finding is a false positive.
//
// The gap that leaves: a genuinely new render-time ref write would be
// caught by nothing. This guard runs the rule anyway and fails on any
// finding that isn't in the committed baseline.
//
// The pure half lives here so it can be unit tested directly. The ESLint
// invocation is here too, so the test and the CLI check the same thing
// rather than two implementations that can disagree -- same structure as
// scripts/americanEnglish.mjs.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const BASELINE_PATH = join(REPO_ROOT, "scripts", "react-hooks-refs-baseline.json");
export const RULE = "react-hooks/refs";

/**
 * An entry is keyed by (file, trimmed source text of the offending
 * line). Deliberately NOT by count, and NOT by line number.
 *
 * **Counts are unusable**, and this was measured rather than assumed.
 * Planting one real violation into Popover.tsx, which had
 * three findings, produced ONE finding: the planted one, with all three
 * originals no longer reported. The rule's output is neither additive
 * nor monotonic -- adding a violation can REDUCE the count. A guard that
 * failed on "count went up" would have seen 3 -> 1 and passed silently,
 * at the exact moment it was most needed. The same experiment in
 * TimePicker.tsx went 6 -> 7, reporting the planted one alongside all
 * six. Two files, two different behaviors.
 *
 * **Line numbers churn** on any edit above them, which would turn every
 * unrelated change into a baseline refresh and train people to run
 * `--update` without reading it.
 *
 * The source text is stable across unrelated edits and is readable in a
 * diff, so a reviewer can see what changed without running anything.
 *
 * The separator is written as the ESCAPE `\u0000`, never as a literal
 * NUL byte in this file. NUL is the right separator -- it cannot occur
 * in a path or in source text, so no (file, text) pair can collide with
 * another through it, which a space cannot promise. But typing the raw
 * byte here made `file(1)` report this module as `data` rather than
 * text, and every search tool with binary detection -- ugrep, ripgrep,
 * plain grep, GitHub code search -- then skipped the WHOLE FILE
 * silently. A zero-result search looks identical to an absent string,
 * so the file most likely to be read by someone staring at a new
 * finding was the one file they could not grep. The escape keeps the
 * runtime value and keeps the source ASCII.
 */
export function entryKey(entry) {
  return `${entry.file}\u0000${entry.text}`;
}

/** Runs ESLint with the rule forced on and returns the findings. */
export function collectFindings() {
  let raw;
  try {
    raw = execFileSync(
      "npx",
      ["eslint", ".", "--rule", JSON.stringify({ [RULE]: "error" }), "-f", "json"],
      { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (error) {
    // ESLint exits non-zero whenever it reports anything, which is the
    // normal case here -- the findings are on stdout regardless. Only a
    // genuine failure to run leaves stdout empty.
    raw = error.stdout ?? "";
    if (!raw.trim()) {
      throw new Error(`Could not run ESLint for ${RULE}:\n${error.stderr ?? error.message}`);
    }
  }

  const results = JSON.parse(raw);
  const findings = [];
  for (const result of results) {
    const file = relative(REPO_ROOT, result.filePath);
    const lines = result.source?.split("\n") ?? null;
    for (const message of result.messages) {
      if (message.ruleId !== RULE) continue;
      const text = (lines ? lines[message.line - 1] : readSourceLine(result.filePath, message.line)) ?? "";
      findings.push({ file, line: message.line, text: text.trim() });
    }
  }
  return findings;
}

function readSourceLine(absolutePath, line) {
  try {
    return readFileSync(absolutePath, "utf8").split("\n")[line - 1];
  } catch {
    return "";
  }
}

/** The committed expectation. */
export function readBaseline() {
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
}

/**
 * Compares findings against the baseline.
 *
 * `added` fails the build; `removed` does not.
 *
 * Removals are informational ON PURPOSE. The Popover experiment above
 * shows findings vanish precisely WHEN something real is added, so
 * failing on shrinkage would fire a false alarm at the worst possible
 * moment -- and worse, it would fire alongside the real failure and
 * muddy it.
 *
 * KNOWN LIMITATION, written down here rather than left to be discovered:
 * a new violation whose offending source text exactly matches an entry
 * already baselined FOR THE SAME FILE passes unnoticed. Adding a second
 * `ref={refs.setFloating}` to Popover.tsx, say. That is an acceptable
 * hole -- the text in question is a known false-positive shape, so
 * another instance of it is a false positive too. It is a hole in
 * detecting *duplicates of known-benign lines*, not in detecting new
 * kinds of violation.
 */
export function diffAgainstBaseline(findings, baseline) {
  const baselineKeys = new Set(baseline.map(entryKey));
  const findingKeys = new Set(findings.map(entryKey));

  const seen = new Set();
  const added = [];
  for (const finding of findings) {
    const key = entryKey(finding);
    if (baselineKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    added.push(finding);
  }

  const removed = baseline.filter((entry) => !findingKeys.has(entryKey(entry)));
  return { added, removed };
}

/** The baseline's on-disk shape: sorted, line numbers dropped.
 *
 * Line numbers are deliberately absent from the committed file. Keeping
 * them would make every unrelated edit above a finding produce a diff,
 * which is the churn this keying exists to avoid. */
export function toBaselineShape(findings) {
  const unique = new Map();
  for (const finding of findings) {
    const key = entryKey(finding);
    if (!unique.has(key)) unique.set(key, { file: finding.file, text: finding.text });
  }
  return [...unique.values()].sort((a, b) => a.file.localeCompare(b.file) || a.text.localeCompare(b.text));
}
