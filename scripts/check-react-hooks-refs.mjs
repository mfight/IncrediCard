#!/usr/bin/env node
// CLI for the react-hooks/refs baseline guard.
//
//   npm run lint:refs             check against the committed baseline
//   npm run lint:refs -- --update rewrite the baseline
//
// The logic lives in reactHooksRefs.mjs so the unit test and this
// command check the same thing.

import { writeFileSync } from "node:fs";
import { relative } from "node:path";
import {
  BASELINE_PATH,
  REPO_ROOT,
  collectFindings,
  diffAgainstBaseline,
  readBaseline,
  toBaselineShape,
} from "./reactHooksRefs.mjs";

const update = process.argv.includes("--update");
const findings = collectFindings();

if (update) {
  const baseline = toBaselineShape(findings);
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Updated ${relative(REPO_ROOT, BASELINE_PATH)} -- ${baseline.length} entries.`);
  console.log("Read the diff before committing: every entry is a finding someone judged a false positive.");
  process.exit(0);
}

const { added, removed } = diffAgainstBaseline(findings, readBaseline());

if (removed.length) {
  // Informational only. See diffAgainstBaseline for why this must not
  // fail the build.
  console.log(`${removed.length} baselined finding(s) no longer reported:`);
  for (const entry of removed) console.log(`  ${entry.file}  ${entry.text}`);
  console.log("Not a failure. Refresh with `npm run lint:refs -- --update` when convenient.\n");
}

if (!added.length) {
  console.log(`react-hooks/refs guard: ${findings.length} finding(s), all baselined.`);
  process.exit(0);
}

console.error(`react-hooks/refs guard FAILED -- ${added.length} finding(s) not in the baseline.\n`);
for (const finding of added) {
  console.error(`  ${finding.file}:${finding.line}`);
  console.error(`    ${finding.text}\n`);
}
console.error(
  [
    "This rule is OFF in eslint.config.mjs because every finding it reported",
    "when it was turned off was a false positive.",
    "",
    "So a new entry is not automatically a bug. It needs a human judgment:",
    "",
    "  * A genuine render-time ref write -- fix it. This guard exists for",
    "    exactly this case, and it is the one the rule being off would miss.",
    "  * Another false positive of a known shape -- accept it and refresh the",
    "    baseline with `npm run lint:refs -- --update`, and say why in the",
    "    commit message so the next reader does not have to re-derive it.",
  ].join("\n"),
);
process.exit(1);
