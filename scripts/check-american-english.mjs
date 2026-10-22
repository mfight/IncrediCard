#!/usr/bin/env node
// CLI wrapper around scripts/americanEnglish.mjs.
//
// The same scan also runs as a unit test, so `npm test` enforces this
// without anyone remembering the command. This entry point exists for
// running it alone and reading the full report.
//
// Usage: npm run check:american-english

import { EXEMPT_FILES, scanRepository } from "./americanEnglish.mjs";

const { findings, filesScanned } = scanRepository();

if (findings.length === 0) {
  console.log(`American English check: ${filesScanned} files, no British spellings outside the allowed set.`);
  console.log(`${EXEMPT_FILES.size} file-level exemptions, each with a stated reason (see americanEnglish.mjs).`);
  process.exit(0);
}

console.error(`American English check FAILED -- ${findings.length} finding(s) in ${filesScanned} files scanned.\n`);
for (const finding of findings) {
  console.error(`  ${finding.file}:${finding.line}`);
  console.error(`    found "${finding.found}" -- American English uses "${finding.american}"`);
  console.error(`    ${finding.text}`);
}
console.error(
  "\nIf an instance is deliberate -- prose that QUOTES a British spelling as its subject,\n" +
    "or a historical value that cannot be renamed -- mark that line with\n" +
    "`allow-british: <reason>` inside whatever comment syntax the file uses.\n" +
    "The marker covers its own line only, and the reason is required."
);
process.exit(1);
