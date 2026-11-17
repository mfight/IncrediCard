// One version's release notes, read from CHANGELOG.md.
//
// The changelog is the only place release notes are written. The release
// workflow uses this to refuse a tag whose version has no entry, and to give
// the tag's GitHub release that entry as its notes. See
// scripts/release-notes.mjs for the command-line entry point.

/**
 * The body of a version's section in a Keep a Changelog file: everything
 * after its `## [x.y.z]` heading up to the next version's heading, without
 * the link definitions at the end of the file. `null` when there's no
 * section for that version, or when the section is empty.
 *
 * @param {string} changelog
 * @param {string} version  without the leading "v"
 * @returns {string | null}
 */
export function releaseNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) return null;

  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## [")) break;
    if (/^\[[^\]]+\]:\s/.test(line)) continue;
    body.push(line);
  }

  const notes = body.join("\n").trim();
  return notes === "" ? null : `${notes}\n`;
}
