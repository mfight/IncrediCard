import { describe, expect, it } from "vitest";
import { BRITISH_SPELLINGS, EXEMPT_FILES, scanRepository, scanText } from "./americanEnglish.mjs";

// "American English is the base" is a written project rule that
// had drifted back into 28 files before anyone looked, and drifted again
// afterwards -- this suite was written against 24 fresh instances that had
// crept in since the last hand sweep. Enforcement by noticing is not
// enforcement.

describe("the word list", () => {
  it("catches the spellings that actually drifted in", () => {
    // Every one of these was really in the repository when this was
    // written. Not hypothetical vocabulary.
    const realDrift = [
      "stays vertically centred against the boxes", // allow-british: test fixture -- this suite exists to catch these
      "everything around it greys out", // allow-british: test fixture -- this suite exists to catch these
      "disabled in the neighbouring pane", // allow-british: test fixture -- this suite exists to catch these
      "so Tab order, labelling, and aria-describedby", // allow-british: test fixture -- this suite exists to catch these
      "travelling far enough to risk clipping", // allow-british: test fixture -- this suite exists to catch these
      "the icon would shift its neighbours", // allow-british: test fixture -- this suite exists to catch these
      "tabIndex is what actually places it; honour the caller", // allow-british: test fixture -- this suite exists to catch these
      "colours, rather than holding a frozen frame", // allow-british: test fixture -- this suite exists to catch these
      "catalogued on the Foundations page", // allow-british: test fixture -- this suite exists to catch these
      "never serialise identically", // allow-british: test fixture -- this suite exists to catch these
      "which the rule cannot recognise as", // allow-british: test fixture -- this suite exists to catch these
    ];
    for (const line of realDrift) {
      expect(scanText(line), line).not.toEqual([]);
    }
  });

  it("reports the American form, not just the offense", () => {
    const [finding] = scanText("the neighbouring pane"); // allow-british: test fixture -- this suite exists to catch these
    expect(finding.found.toLowerCase()).toBe("neighbouring"); // allow-british: test fixture -- this suite exists to catch these
    expect(finding.american).toBe("neighbor");
  });

  // These are the false positives found while building the sweep. Each
  // one, flagged, would train people to ignore the check -- which is
  // worse than not having it.
  it.each([
    ["aria-labelledby", "a real ARIA attribute, not the word `labelled`"], // allow-british: test fixture -- this suite exists to catch these
    ["<LabelList /> renders", "an API name"],
    ["static analysis of the bundle", "`analysis` is correct in both"],
    ["order fulfillment is complete", "already American; `fulfil` is only a prefix of it"], // allow-british: test fixture -- this suite exists to catch these
    ["the organism under study", "`organism` is correct in both"],
    ["a <dialog> element", "the HTML element"],
    ["cancellation policy applies", "spelled the same in both"],
    ["center the grid", "already American"],
    ["gray-500 token", "already American"],
  ])("does not flag %s (%s)", (line) => {
    expect(scanText(line)).toEqual([]);
  });
});

// The word list above is an enumeration and this family is
// productive, so enumeration loses. "parenthesised" passed a clean run (allow-british: names the word that escaped)
// three times for exactly that reason.
describe("the -ise/-isation suffix family", () => {
  it.each([
    "the parenthesised region renders", // allow-british: test fixture -- this suite exists to catch these
    "values are normalised before use", // allow-british: test fixture -- this suite exists to catch these
    "options categorised by group", // allow-british: test fixture -- this suite exists to catch these
    "prioritised over the fallback", // allow-british: test fixture -- this suite exists to catch these
    "tokenised at parse time", // allow-british: test fixture -- this suite exists to catch these
    "the synchronisation step", // allow-british: test fixture -- this suite exists to catch these
    "memoising the selector", // allow-british: test fixture -- this suite exists to catch these
    "it randomises the order", // allow-british: test fixture -- this suite exists to catch these
  ])("catches %s", (line) => {
    expect(scanText(line), line).not.toEqual([]);
  });

  it("reports the -ize form of the exact word, inflection intact", () => {
    expect(scanText("parenthesised")[0].american).toBe("parenthesized"); // allow-british: test fixture -- this suite exists to catch these
    expect(scanText("synchronisation")[0].american).toBe("synchronization"); // allow-british: test fixture -- this suite exists to catch these
    expect(scanText("memoising")[0].american).toBe("memoizing"); // allow-british: test fixture -- this suite exists to catch these
  });

  // The expensive failure direction. Every one of these is correct
  // American English, and flagging it would train people to switch the
  // check off -- which is worse than not having the rule at all.
  it.each([
    ["we advertise the port", "-ise is the American spelling here"],
    ["a surprising result", "surprise"],
    ["exercise the failing path", "exercise"],
    ["otherwise the popup closes", "-wise is its own American suffix"],
    ["clockwise and counterclockwise", "-wise compounds"],
    ["comprising three parts", "comprise"],
    ["const p = new Promise(resolve)", "Promise is in most TypeScript files"],
    ["promised behavior", "promise"],
    ["supervised by the parent", "supervise"],
    ["revised after review", "revise"],
    ["devises a new plan", "devise"],
    ["raised the minimum", "raise"],
    ["praised in review", "praise"],
    ["noise in the signal", "noise"],
    ["--surface-raised token", "a real token name"],
    ["an enterprise account", "enterprise"],
    ["expertise required", "expertise"],
    ["the premise holds", "premise"],
    ["a concise summary", "concise"],
    ["arising from the merge", "arise"],
    ["rising edge", "rise"],
    ["disguised as a button", "disguise"],
    ["improvised fallback", "improvise"],
    ["merchandise listing", "merchandise"],
    // Prefixed forms: the allowlist holds stems, not every derivation.
    ["an unsurprising outcome", "un- + surprise"],
    ["imprecise measurement", "im- + precise"],
    ["an unexercised branch", "un- + exercise"],
    ["misadvised approach", "mis- + advise"],
  ])("does not flag %s (%s)", (line) => {
    expect(scanText(line), line).toEqual([]);
  });

  // The guard against "fix it by matching any allowed word as a suffix",
  // which is the obvious shortcut and is wrong: "organise" ends with (allow-british: names the word that breaks the shortcut)
  // "anise", so that shortcut would allow the single most common British
  // spelling in this repository.
  it("still catches a word that merely ends with an allowed one", () => {
    expect(scanText("organise the list"), "organise ends with anise").not.toEqual([]); // allow-british: test fixture -- this suite exists to catch these
    expect(scanText("reorganised the tree")).not.toEqual([]); // allow-british: test fixture -- this suite exists to catch these
    expect(scanText("unrecognised command")).not.toEqual([]); // allow-british: test fixture -- this suite exists to catch these
  });

  it("finds a wrong word sharing a line with a correct one", () => {
    // A non-global match would stop at "otherwise" and report nothing.
    const findings = scanText("otherwise the value is normalised"); // allow-british: test fixture -- this suite exists to catch these
    expect(findings).toHaveLength(1);
    expect(findings[0].found.toLowerCase()).toBe("normalised"); // allow-british: test fixture -- this suite exists to catch these
  });

  it("reports a word covered by both rules exactly once", () => {
    // `organis(e|...)` is in the word list AND matches the suffix rule.
    const findings = scanText("organised by group"); // allow-british: test fixture -- this suite exists to catch these
    expect(findings).toHaveLength(1);
  });
});

describe("per-instance suppression", () => {
  it("suppresses a marked line", () => {
    expect(scanText('// en-GB overrides to "colour" -- allow-british: quotes locale output')).toEqual([]);
  });

  it("requires a reason", () => {
    // A bare marker with nothing after it must not count, or the marker
    // degrades into a silent mute.
    expect(scanText("// colour -- allow-british:")).not.toEqual([]);
    expect(scanText("// colour -- allow-british:   ")).not.toEqual([]);
  });

  it("covers only its own line", () => {
    // The blast radius matters: these spellings cluster inside multi-line
    // comment blocks, so "also suppress the next line" would hide the
    // very next real drift.
    const text = ['// colour -- allow-british: quoting', "// behaviour drifted in here"].join("\n");
    const findings = scanText(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].line).toBe(2);
  });

  it("works with any comment syntax, because it is just a token", () => {
    expect(scanText('<!-- allow-british: markdown --> says "colour"')).toEqual([]);
    expect(scanText("-- allow-british: sql -- WHERE status = 'cancelled'")).toEqual([]);
    expect(scanText("/* allow-british: css */ // greys")).toEqual([]);
  });
});

describe("the repository", () => {
  const { findings, filesScanned } = scanRepository();

  // A scanner that silently walks nothing passes every assertion below
  // while proving exactly nothing.
  it("actually scanned the repository", () => {
    expect(filesScanned).toBeGreaterThan(30);
  });

  it("has no British spellings outside the allowed set", () => {
    const report = findings
      .map((f: { file: string; line: number; found: string; american: string }) =>
        `${f.file}:${f.line} "${f.found}" -> "${f.american}"`
      )
      .join("\n");
    expect(findings, report).toEqual([]);
  });

  it("keeps file-level exemptions few, and each with a reason", () => {
    // File-level exemption is the blunt instrument: it hides all future
    // drift in that file. Only whole files that are legitimately not
    // American English belong here; anything merely mostly-American uses
    // a per-line marker instead.
    expect(EXEMPT_FILES.size).toBeLessThanOrEqual(8);
    for (const [file, reason] of EXEMPT_FILES) {
      expect(reason, `${file} needs a stated reason`).toBeTruthy();
      expect(reason.length, `${file}'s reason is too terse to be useful`).toBeGreaterThan(15);
    }
  });

  it("has a non-trivial word list", () => {
    expect(BRITISH_SPELLINGS.length).toBeGreaterThan(30);
  });
});
