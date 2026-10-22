// Enforcement for "American English is the base; British
// spellings live only in en-GB/en-AU/en-CA."
//
// That rule is written down, and it had still drifted back into 28
// files / 45 lines before anyone looked. A rule enforced by someone
// happening to notice is not enforced.
//
// The pure half lives here so it can be unit tested directly. The
// repository walk is here too, so the test and the CLI check exactly the
// same thing rather than two implementations that can disagree.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Every pattern is anchored with \b at BOTH ends, which is doing real
// work rather than being decoration. Without it:
//   - `labelled` matches inside `aria-labelledby`, a real API name (allow-british: the pattern being explained)
//   - `fulfil` matches inside `fulfillment`, which is already American (allow-british: the pattern being explained)
//   - `organis` matches inside `organism`, which is correct everywhere
//
// Each entry carries the American form so the failure message tells the
// author what to write instead of only what not to.
export const BRITISH_SPELLINGS = [
  [/\bcolour(s|ed|ing|ful|less)?\b/i, "color"],
  [/\bfavour(s|ed|ing|able|ably|ite|ites)?\b/i, "favor"],
  [/\bbehaviour(s|al|ally)?\b/i, "behavior"],
  [/\bneighbour(s|ing|hood|hoods)?\b/i, "neighbor"],
  [/\bhonour(s|ed|ing|able)?\b/i, "honor"],
  [/\bcentre(s|d)?\b/i, "center"],
  [/\bmetre(s)?\b/i, "meter"],
  // Only the -ise family, never a bare `organis` prefix: `organism` and
  // `organisms` are correct in American English.
  [/\borganis(e|es|ed|ing|ation|ations|ational)\b/i, "organize / organization"],
  [/\binitialis(e|es|ed|ing|ation)\b/i, "initialize / initialization"],
  [/\bnormalis(e|es|ed|ing|ation)\b/i, "normalize / normalization"],
  [/\bserialis(e|es|ed|ing|ation)\b/i, "serialize / serialization"],
  [/\bcustomis(e|es|ed|ing|ation)\b/i, "customize / customization"],
  [/\bcapitalis(e|es|ed|ing|ation)\b/i, "capitalize / capitalization"],
  [/\bsanitis(e|es|ed|ing|ation)\b/i, "sanitize / sanitization"],
  [/\brecognis(e|es|ed|ing)\b/i, "recognize"],
  [/\bemphasis(e|es|ed|ing)\b/i, "emphasize"],
  // `analysis` is correct in both and is NOT matched: "analyse" is not a (allow-british: the pattern being explained)
  // prefix of "analysis".
  [/\banalys(e|es|ed|ing)\b/i, "analyze"],
  [/\blicence(s|d)?\b/i, "license"],
  [/\bdefence(s)?\b/i, "defense"],
  [/\boffence(s)?\b/i, "offense"],
  [/\bpractise(s|d|ing)?\b/i, "practice"], // allow-british: the pattern IS the spelling it looks for
  [/\bwhilst\b/i, "while"],
  [/\bamongst\b/i, "among"],
  [/\bfulfil\b/i, "fulfill"],
  [/\bfulfilment\b/i, "fulfillment"],
  [/\bgrey(s|ed|ing|scale)?\b/i, "gray / grayscale"],
  [/\blabelled\b/i, "labeled"],
  [/\blabelling\b/i, "labeling"],
  [/\bcancelled\b/i, "canceled"],
  [/\bcancelling\b/i, "canceling"],
  [/\bcancellation(s)?\b/i, "cancellation is correct; check surrounding text"],
  [/\bmodelled\b/i, "modeled"],
  [/\bmodelling\b/i, "modeling"],
  [/\btravelled\b/i, "traveled"],
  [/\btravelling\b/i, "traveling"],
  [/\btraveller(s)?\b/i, "traveler"],
  [/\bcatalogue(s|d)?\b/i, "catalog"],
  [/\bprogramme(s)?\b/i, "program"],
  [/\bjudgement(s)?\b/i, "judgment"],
  [/\benrol\b/i, "enroll"],
  [/\benrolment\b/i, "enrollment"],
];

// `cancellation` is spelled the same on both sides of the Atlantic --
// listed above only so the message can say so, never as a failure.
const NOT_ACTUALLY_BRITISH = new Set(["cancellation is correct; check surrounding text"]);

// The list above is an enumeration, and this suffix family is
// PRODUCTIVE -- any verb can take it. Enumeration therefore loses by
// default, and it did: "parenthesised" sat in three places in (allow-british: the word this rule was built for)
// LocalePicker while the check reported a clean run. A clean
// run is the whole output of this tool, so a gap in it is not a missing
// feature, it is a wrong answer.
//
// So this rule works by SUBTRACTION instead: match every word ending in
// -ise/-ised/-ises/-ising/-isation, then remove the ones that are
// genuinely American.
const ISE_SUFFIX = /\b[A-Za-z]+is(?:e|es|ed|ing|ation|ations|ational)\b/g;

// The finite, well-known set of English words spelled -ise in American
// English -- they are NOT the British variant of an -ize word, so
// flagging them would be flagging correct text.
//
// Listed in BASE form only (the -ise spelling). Inflections are derived
// in `iseBaseForm` below rather than enumerated, so "advertising",
// "advertised" and "advertises" all resolve to "advertise" and none of
// the three has to be remembered here.
//
// Getting this set wrong in the FLAGGING direction is the expensive
// failure (see section 266): a check that reports correct prose is one
// people switch off. `Promise` alone would fire on most TypeScript files
// in the repository.
export const ISE_ALWAYS_CORRECT = new Set([
  // Verbs whose American spelling really is -ise.
  "advertise", "advise", "apprise", "arise", "chastise", "circumcise",
  "comprise", "compromise", "despise", "devise", "disguise", "excise",
  "exercise", "improvise", "incise", "merchandise", "prise", "promise",
  "reprise", "revise", "rise", "supervise", "surmise", "surprise",
  "televise",
  // Nouns and adjectives that simply end this way.
  "anise", "cerise", "concise", "demise", "enterprise", "expertise",
  "franchise", "guise", "malaise", "mayonnaise", "mortise", "noise",
  "paradise", "poise", "porpoise", "praise", "precise", "premise",
  "raise", "treatise", "tortoise", "turquoise", "valise",
  // Things that get raised, praised and cruised.
  "bruise", "cruise", "sunrise", "uprise",
]);

/** Normalizes an -ise-family word to the base form the allowlist holds.
 *
 * "advertising" -> "advertise", "advertised"/"advertises" ->
 * "advertise", "advertise" -> itself. Words in -isation are not
 * normalized because no American word ends that way, so they can never
 * be on the allowlist.
 */
function iseBaseForm(word) {
  const lower = word.toLowerCase();
  if (lower.endsWith("ising")) return `${lower.slice(0, -3)}e`;
  if (lower.endsWith("ised") || lower.endsWith("ises")) return lower.slice(0, -1);
  return lower;
}

// Prefixes that derive a new word without changing how it is spelled at
// the end: "unsurprising", "imprecise", "unexercised", "misadvise".
// Stripped before the allowlist is consulted so those do not have to be
// enumerated alongside their stems.
//
// Stripping a PREFIX, never a suffix: testing whether a word merely ENDS
// WITH an allowed one is unsafe in both directions here. "organise" ends (allow-british: names the word that makes suffix matching unsafe)
// with "anise", and treating that as a match would silently allow the
// single most common British spelling in this repository.
const NEUTRAL_PREFIXES = ["un", "im", "in", "dis", "non", "mis", "over", "under", "counter", "re", "pre", "inter", "sub"];

/** True for a word this rule must NOT flag. */
function isCorrectIseWord(word) {
  const base = iseBaseForm(word);
  // `-wise` is a productive American suffix of its own (otherwise,
  // likewise, clockwise, bitwise, pairwise, lengthwise...). Enumerating
  // those would repeat this rule's original mistake one level down.
  if (base === "wise" || base.endsWith("wise")) return true;
  if (ISE_ALWAYS_CORRECT.has(base)) return true;

  for (const prefix of NEUTRAL_PREFIXES) {
    if (!base.startsWith(prefix)) continue;
    if (ISE_ALWAYS_CORRECT.has(base.slice(prefix.length))) return true;
  }
  return false;
}

/** The American spelling of a flagged word: the suffix's `is` becomes
 * `iz`, preserving whatever inflection it carried.
 * "parenthesised" -> "parenthesized"; "organisation" -> "organization". (allow-british: shows this transformation's own input) */
function americanIseForm(word) {
  return word.replace(/is(e|es|ed|ing|ation|ations|ational)$/i, "iz$1");
}

/** Every British -ise-family word on one line, allowlist already
 * subtracted. Scans ALL matches rather than just the first: one line can
 * carry a correct word and a wrong one, and stopping at the first would
 * let "otherwise normalised" through. (allow-british: the example of a correct and a wrong word sharing a line) */
export function findIseSuffixWords(line) {
  const words = line.match(ISE_SUFFIX) ?? [];
  return words.filter((word) => !isCorrectIseWord(word));
}

/**
 * Per-instance suppression, deliberately NOT a path ignore list.
 *
 * The hard case this exists for is a file that is mostly American but
 * quotes British spelling AS ITS SUBJECT. A localization doc can contain
 * the line:
 *
 *   `en-US` says "color"; `en-GB`/`en-AU`/`en-CA` override to "colour" (allow-british: quotes the doc line this exists for)
 *
 * "Fixing" that line to `override to "color"` would leave a sentence that
 * says nothing. Blanket-exempting the file would hide the next real drift
 * inside it; exempting the line, with a reason, does not.
 *
 * The marker works in any language's comment syntax because it is just a
 * token the author puts inside whatever comment that file type uses.
 *
 * It suppresses its OWN LINE ONLY. Also suppressing the following line
 * would let a marker sit above something that cannot hold a trailing
 * comment, but it doubles every marker's blast radius, and these spellings
 * cluster inside multi-line comment blocks where the next line is exactly
 * where the next real drift would be.
 */
export const ALLOW_MARKER = /allow-british:\s*(\S.*)$/;

const SCANNED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".scss", ".css",
  ".md", ".mdx",
  ".sql", ".yml", ".yaml",
]);

// Whole files whose CONTENT is legitimately not American English. Each
// needs a reason, and the list is deliberately short -- anything that is
// merely mostly-American belongs on a per-line marker instead.
export const EXEMPT_FILES = new Map();

const EXEMPT_DIRECTORIES = [
  "node_modules",
  ".git",
  "dist",
  "storybook-static",
  "test-results",
  "playwright-report",
];

function isExempt(relativePath) {
  if (EXEMPT_FILES.has(relativePath)) return true;
  return EXEMPT_DIRECTORIES.some(
    (directory) => relativePath === directory || relativePath.startsWith(`${directory}/`)
  );
}

/** Finds British spellings in one file's text, honoring allow markers. */
export function scanText(text, relativePath = "<text>") {
  const lines = text.split("\n");
  const findings = [];

  lines.forEach((line, index) => {
    if (ALLOW_MARKER.test(line)) return;

    // Words already reported on this line by an explicit entry, so the
    // suffix rule below does not report them a second time. Several
    // entries above (organis-, normalis-, recognis- and the rest) are
    // subsets of the suffix family; they stay because they carry a
    // better message than the generic one, and this is what keeps that
    // overlap from double-reporting.
    const reported = new Set();

    for (const [pattern, american] of BRITISH_SPELLINGS) {
      if (NOT_ACTUALLY_BRITISH.has(american)) continue;
      const match = line.match(pattern);
      if (match) {
        reported.add(match[0].toLowerCase());
        findings.push({
          file: relativePath,
          line: index + 1,
          found: match[0],
          american,
          text: line.trim().slice(0, 120),
        });
      }
    }

    // The productive -ise/-isation family, which no
    // enumeration can keep up with.
    for (const word of findIseSuffixWords(line)) {
      if (reported.has(word.toLowerCase())) continue;
      reported.add(word.toLowerCase());
      findings.push({
        file: relativePath,
        line: index + 1,
        found: word,
        american: americanIseForm(word),
        text: line.trim().slice(0, 120),
      });
    }
  });

  return findings;
}

function walk(directory, found = []) {
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    const relativePath = relative(REPO_ROOT, absolute);
    if (isExempt(relativePath)) continue;
    if (statSync(absolute).isDirectory()) {
      walk(absolute, found);
      continue;
    }
    const dot = entry.lastIndexOf(".");
    if (dot === -1) continue;
    const extension = entry.slice(dot);
    const scanned = SCANNED_EXTENSIONS.has(extension);
    if (!scanned) continue;
    found.push({ absolute, relativePath });
  }
  return found;
}

export function scanRepository() {
  const findings = [];
  let filesScanned = 0;
  for (const { absolute, relativePath } of walk(REPO_ROOT)) {
    filesScanned += 1;
    findings.push(...scanText(readFileSync(absolute, "utf8"), relativePath));
  }
  return { findings, filesScanned };
}
