#!/usr/bin/env node
// Prints a version's release notes from CHANGELOG.md, or fails when the
// changelog has no entry for it. The release workflow runs this for the
// pushed tag, before staging anything on npm, and again to write the GitHub
// release's notes.
//
// Usage: node scripts/release-notes.mjs 1.2.3

import { readFileSync } from "node:fs";
import { releaseNotes } from "./releaseNotes.mjs";

const version = process.argv[2]?.replace(/^v/, "");
if (!version) {
  console.error("Usage: node scripts/release-notes.mjs <version>");
  process.exit(2);
}

const notes = releaseNotes(readFileSync("CHANGELOG.md", "utf8"), version);
if (notes === null) {
  console.error(`CHANGELOG.md has no entry for ${version}. Add a "## [${version}] - YYYY-MM-DD" section first.`);
  process.exit(1);
}

process.stdout.write(notes);
