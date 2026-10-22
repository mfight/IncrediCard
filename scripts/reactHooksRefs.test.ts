import { describe, expect, it } from "vitest";
import { diffAgainstBaseline, entryKey, toBaselineShape } from "./reactHooksRefs.mjs";

// The pure half of the react-hooks/refs baseline guard.
//
// Only the diffing logic is unit tested. The ESLint run itself is not:
// it takes tens of seconds, and `npm test` is currently ~1s. The real
// check against the real repository is `npm run lint:refs`, which CI
// runs on every push and PR -- that is the thing that would catch a
// stale baseline, and putting a slow duplicate of it here would buy
// nothing.

type Entry = { file: string; text: string; line?: number };

const baseline: Entry[] = [
  { file: "a.tsx", text: "ref={refs.setFloating}" },
  { file: "a.tsx", text: "refs.setReference," },
  { file: "b.tsx", text: "dir={hourPanel.dir}" },
];

describe("baseline keying", () => {
  it("keys on file and source text together, not either alone", () => {
    // The same source text in two files is two entries. A shared line
    // like `ref={refs.setFloating}` appears in most of these components.
    expect(entryKey({ file: "a.tsx", text: "x" })).not.toBe(entryKey({ file: "b.tsx", text: "x" }));
    expect(entryKey({ file: "a.tsx", text: "x" })).not.toBe(entryKey({ file: "a.tsx", text: "y" }));
  });

  it("ignores line numbers entirely", () => {
    // An edit anywhere above a finding shifts its line. If that produced
    // a baseline diff, every unrelated change would demand a refresh and
    // people would start running --update without reading it.
    expect(entryKey({ file: "a.tsx", text: "x", line: 10 })).toBe(entryKey({ file: "a.tsx", text: "x", line: 900 }));
  });
});

describe("diffAgainstBaseline", () => {
  it("reports nothing when the findings match", () => {
    const { added, removed } = diffAgainstBaseline(baseline.map((e, i) => ({ ...e, line: i + 1 })), baseline);
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  it("reports a finding the baseline does not have", () => {
    const findings = [...baseline, { file: "c.tsx", text: "planted.current = 1;", line: 5 }];
    const { added } = diffAgainstBaseline(findings, baseline);
    expect(added).toHaveLength(1);
    expect(added[0].file).toBe("c.tsx");
    expect(added[0].line).toBe(5);
  });

  it("does not care that a baselined finding moved lines", () => {
    const findings = baseline.map((e) => ({ ...e, line: 999 }));
    expect(diffAgainstBaseline(findings, baseline).added).toEqual([]);
  });

  // The behavior the whole design turns on, measured when the guard was
  // written and reproduced live against this implementation: planting ONE real
  // violation in Popover.tsx removed THREE existing findings. Net -2. A
  // guard that failed on "count went up" would have passed silently at
  // the exact moment it mattered.
  it("still fails when an addition is accompanied by more removals", () => {
    const findings = [
      { file: "b.tsx", text: "dir={hourPanel.dir}", line: 1 },
      { file: "a.tsx", text: "planted.current = 1;", line: 2 },
    ];
    const { added, removed } = diffAgainstBaseline(findings, baseline);
    expect(findings.length).toBeLessThan(baseline.length); // the count went DOWN
    expect(added).toHaveLength(1); // and it still fails
    expect(removed).toHaveLength(2);
  });

  it("treats disappearances as informational, never as a failure", () => {
    const { added, removed } = diffAgainstBaseline([baseline[0]], baseline);
    expect(added).toEqual([]);
    expect(removed).toHaveLength(2);
  });

  it("reports a repeated new finding once", () => {
    const findings = [
      { file: "c.tsx", text: "planted.current = 1;", line: 5 },
      { file: "c.tsx", text: "planted.current = 1;", line: 5 },
    ];
    expect(diffAgainstBaseline(findings, baseline).added).toHaveLength(1);
  });

  // The documented hole, asserted rather than only described, so that
  // anyone changing the keying finds out here what they are trading
  // away. A second identical line in an already-baselined file passes.
  // Acceptable: that text is a known false-positive shape, so another
  // instance of it is a false positive too.
  it("KNOWN LIMITATION: a duplicate of a baselined line in the same file passes", () => {
    const findings = [
      { file: "a.tsx", text: "ref={refs.setFloating}", line: 10 },
      { file: "a.tsx", text: "ref={refs.setFloating}", line: 42 },
    ];
    expect(diffAgainstBaseline(findings, baseline).added).toEqual([]);
  });
});

describe("toBaselineShape", () => {
  it("drops line numbers, dedupes, and sorts", () => {
    const shaped = toBaselineShape([
      { file: "b.tsx", text: "zzz", line: 9 },
      { file: "a.tsx", text: "bbb", line: 2 },
      { file: "a.tsx", text: "aaa", line: 1 },
      { file: "a.tsx", text: "aaa", line: 7 },
    ]);
    expect(shaped).toEqual([
      { file: "a.tsx", text: "aaa" },
      { file: "a.tsx", text: "bbb" },
      { file: "b.tsx", text: "zzz" },
    ]);
  });

  // IncrediCard really does report the same line four times, which is
  // why the raw finding count (27) and the baseline size (24) differ.
  it("collapses a line reported several times", () => {
    const shaped = toBaselineShape([
      { file: "s.tsx", text: "same", line: 909 },
      { file: "s.tsx", text: "same", line: 909 },
      { file: "s.tsx", text: "same", line: 909 },
      { file: "s.tsx", text: "same", line: 909 },
    ]);
    expect(shaped).toHaveLength(1);
  });
});
