import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { releaseNotes } from "./releaseNotes.mjs";

const changelog = `# Changelog

Intro text.

## [1.1.0] - 2027-01-02

### Added

- Something new.

## [1.0.1] - 2027-01-01

### Changed

- A fix.

## [1.0.0] - 2026-12-31

The first release.

## [0.9.0] - 2026-12-01

[1.1.0]: https://example.com/compare/v1.0.1...v1.1.0
[1.0.1]: https://example.com/compare/v1.0.0...v1.0.1
`;

describe("releaseNotes", () => {
  it("returns the section between a version's heading and the next one", () => {
    expect(releaseNotes(changelog, "1.1.0")).toBe("### Added\n\n- Something new.\n");
    expect(releaseNotes(changelog, "1.0.1")).toBe("### Changed\n\n- A fix.\n");
  });

  it("leaves out the link definitions after the last section", () => {
    expect(releaseNotes(changelog, "1.0.0")).toBe("The first release.\n");
  });

  it("matches the whole version, not a prefix of it", () => {
    expect(releaseNotes(changelog, "1.0")).toBeNull();
    expect(releaseNotes(changelog, "1.1.0-beta")).toBeNull();
  });

  it("returns null for a missing version or an empty section", () => {
    expect(releaseNotes(changelog, "2.0.0")).toBeNull();
    expect(releaseNotes(changelog, "0.9.0")).toBeNull();
  });
});

describe("CHANGELOG.md", () => {
  it("has an entry for the version in package.json", () => {
    // The release workflow refuses a tag without one; this catches a
    // version bump that forgot the changelog before anything is tagged.
    const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(releaseNotes(readFileSync("CHANGELOG.md", "utf8"), version)).not.toBeNull();
  });
});
