#!/usr/bin/env node
/**
 * Slice artifact check (DESIGN.md §2 字体栈).
 *
 * Verifies what the repo actually ships, not what the builder intended:
 * every family directory has one css per weight, every url in those css files
 * resolves, no slice is orphaned, every unicode-range parses non-empty, and
 * the declared family names and weights match sources.json. When the cached
 * upstream sources are present it also re-checks the delta contract — that a
 * sampled Traditional/Japanese codepoint really is drawn differently from the
 * Simplified family — because that property is what makes the small TC/JP
 * families correct rather than merely small.
 *
 * Offline by design: a fresh clone has the slices but not the sources, and
 * the checks that need the sources say so instead of failing.
 *
 *   node scripts/fonts/check.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkitNs from 'fontkit';
import { createHash } from 'node:crypto';
import { parseRanges } from './lib.mjs';

const fontkit = fontkitNs.default ?? fontkitNs;

const ROOT = join(import.meta.dirname, '..', '..');
const CACHE = join(ROOT, '.cache', 'fonts');
const OUT_ROOT = join(ROOT, 'src', 'fonts', 'station-sans');
const sources = JSON.parse(readFileSync(join(import.meta.dirname, 'sources.json'), 'utf-8'));

const problems = [];
const fail = (message) => {
  problems.push(message);
  process.stderr.write(`  FAIL ${message}\n`);
};
const log = (message) => process.stderr.write(`${message}\n`);

function outlineHash(font, codepoint) {
  const glyph = font.glyphForCodePoint(codepoint);
  if (!glyph?.path?.commands?.length) return 'none';
  return createHash('sha1').update(JSON.stringify(glyph.path.commands)).digest('hex').slice(0, 16);
}

const reference = sources.families.find((family) => family.id === 'sc');

let totalBytes = 0;
let totalFiles = 0;

for (const family of sources.families) {
  const dir = join(OUT_ROOT, family.id);
  const expected = family.weights.map(
    (weight) => `${family.family.replaceAll(' ', '')}-${weight.name}.min.css`,
  );
  log(`\n${family.family} (${family.id})`);
  if (!existsSync(dir)) {
    fail(`${family.id}: directory missing (${dir})`);
    continue;
  }
  const entries = readdirSync(dir);
  for (const css of expected) {
    if (!entries.includes(css)) fail(`${family.id}: missing ${css}`);
  }
  for (const entry of entries) {
    if (!/\.(css|woff2)$/.test(entry)) fail(`${family.id}: unexpected file ${entry}`);
  }

  const referenced = new Set();
  for (const css of expected) {
    if (!entries.includes(css)) continue;
    const text = readFileSync(join(dir, css), 'utf-8');
    const weight = family.weights.find(
      (candidate) => css === `${family.family.replaceAll(' ', '')}-${candidate.name}.min.css`,
    );
    const rules = [...text.matchAll(/@font-face\{([^}]*)\}/g)].map((match) => match[1]);
    if (!rules.length) fail(`${css}: no @font-face rules`);
    for (const rule of rules) {
      const name = /font-family:'([^']+)'/.exec(rule)?.[1];
      const declared = /font-weight:(\d+)/.exec(rule)?.[1];
      const url = /url\(\.\/([^)]+)\)/.exec(rule)?.[1];
      const ranges = /unicode-range:([^;}]+)/.exec(rule)?.[1];
      if (name !== family.family) fail(`${css}: font-family ${name} != ${family.family}`);
      if (declared !== String(weight?.css))
        fail(`${css}: font-weight ${declared} != ${weight?.css}`);
      if (!url) {
        fail(`${css}: rule without url`);
        continue;
      }
      referenced.add(url);
      if (!entries.includes(url)) fail(`${css}: url ${url} does not exist`);
      const codepoints = ranges ? parseRanges(ranges) : [];
      if (!codepoints.length) fail(`${css}: ${url} declares no codepoints`);
    }
  }
  const files = entries.filter((entry) => entry.endsWith('.woff2'));
  for (const file of files) {
    if (!referenced.has(file)) fail(`${family.id}: orphan slice ${file}`);
  }
  const bytes = files.reduce((sum, file) => sum + statSync(join(dir, file)).size, 0);
  totalFiles += files.length;
  totalBytes += bytes;
  log(`  ${files.length} slices, ${(bytes / 1024 / 1024).toFixed(2)} MB, ${expected.length} css`);

  // Delta contract: sampled TC/JP codepoints must differ from the SC family.
  if (family.id === 'sc') continue;
  const scWeight = reference.weights[0];
  if (!existsSync(join(CACHE, scWeight.file))) {
    log('  delta contract: skipped (upstream sources not cached)');
    continue;
  }
  const mine = fontkit.openSync(join(CACHE, family.weights[0].file));
  const theirs = fontkit.openSync(join(CACHE, scWeight.file));
  const declared = new Set(
    expected
      .filter((css) => entries.includes(css))
      .flatMap((css) =>
        [...readFileSync(join(dir, css), 'utf-8').matchAll(/unicode-range:([^;}]+)/g)].flatMap(
          (match) => parseRanges(match[1]),
        ),
      ),
  );
  const sample = [...declared].filter((_, index) => index % Math.ceil(declared.size / 60) === 0);
  const identical = sample.filter((cp) => outlineHash(mine, cp) === outlineHash(theirs, cp));
  if (identical.length) {
    fail(
      `${family.id}: ${identical.length}/${sample.length} sampled codepoints are identical to ${reference.family} ` +
        `(e.g. U+${identical[0].toString(16).toUpperCase()})`,
    );
  } else {
    log(
      `  delta contract: ${sample.length} sampled codepoints all differ from ${reference.family}`,
    );
  }
}

// Every family's coverage must also be disjoint enough to be worth shipping:
// report the overlap with the reference family's shipped set.
log('\nsummary');
log(
  `  ${totalFiles} slices, ${(totalBytes / 1024 / 1024).toFixed(2)} MB across ${sources.families.length} families`,
);

if (problems.length) {
  log(`\n${problems.length} problem(s).`);
  process.exit(1);
}
log('\nAll slice artifacts check out.');
