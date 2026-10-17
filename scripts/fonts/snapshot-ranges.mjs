#!/usr/bin/env node
/**
 * Coverage snapshot (DESIGN.md §2 字体栈).
 *
 * Fetches the Google Fonts css2 slice tables for the three Noto Sans CJK
 * language builds and freezes each family's *coverage* — the union of every
 * unicode-range that family publishes — into scripts/fonts/ranges.json.
 * The tables are a range source only: every woff2 that ships is subsetted
 * locally by scripts/fonts/build.mjs, so the runtime has no third-party font
 * dependency and a rebuild works offline from this snapshot plus the cached
 * sources.
 *
 * Coverage is per family, because each family is baked to one language's
 * glyph forms and only has to hold what that language needs: the zh-Hant
 * pages get the Traditional table, the Simplified pages the Simplified one,
 * and the Japanese family covers the Japanese table (which is what makes
 * Japanese-only kanji such as 畑/峠/込 render in a Japanese face instead of a
 * system fallback). No union is taken — a union would only add codepoints the
 * family cannot render in its own forms.
 *
 * Emoji/symbol blocks are dropped on purpose: claiming them would shadow the
 * platform's colour emoji font with monochrome glyphs.
 *
 * Slice *ordering* is not taken from here (Google's tables are ordered by
 * codepoint block, which makes Chinese pages touch most of the font); the
 * frequency order in scripts/fonts/order.json drives that instead.
 *
 *   node scripts/fonts/snapshot-ranges.mjs
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHROME_UA, fetchText, parseRanges, toRanges } from './lib.mjs';

const SOURCES = JSON.parse(
  (await import('node:fs')).readFileSync(join(import.meta.dirname, 'sources.json'), 'utf-8'),
);
const WEIGHT = 400;

/** Monochrome symbol/pictograph blocks the platform emoji font owns. */
const EXCLUDED = [
  ['emoji', 0x1f000, 0x1faff],
  ['misc-symbols', 0x2600, 0x27bf],
  ['misc-symbols-arrows', 0x2b00, 0x2bff],
  ['dingbat-negative', 0x1f500, 0x1f5ff],
];

function log(message) {
  process.stderr.write(`${message}\n`);
}

const isExcluded = (cp) => EXCLUDED.some(([, start, end]) => cp >= start && cp <= end);

const provenance = {
  source: 'Google Fonts css2 API (per-family sliced woff2 tables)',
  rangeSource: 'unicode-range declarations of every @font-face block',
  requestedWeight: WEIGHT,
  userAgent: CHROME_UA,
  fetchedAt: new Date().toLocaleDateString('sv-SE'),
  families: {},
  excludedBlocks: EXCLUDED.map(([name, start, end]) => ({
    name,
    range: `U+${start.toString(16).toUpperCase()}-${end.toString(16).toUpperCase()}`,
    why: 'platform colour emoji owns these codepoints',
  })),
};

const coverage = {};
for (const family of SOURCES.families) {
  const query = family.coverageFamily.replaceAll(' ', '+');
  const url = `https://fonts.googleapis.com/css2?family=${query}:wght@${WEIGHT}&display=swap`;
  const css = fetchText(url, CHROME_UA);
  const blocks = css.match(/@font-face\s*\{[^{}]*\}/g) ?? [];
  const tableSlices = [];
  for (const block of blocks) {
    const ranges = /unicode-range:\s*([^;}]+)/.exec(block)?.[1];
    if (ranges) tableSlices.push(parseRanges(ranges));
  }
  const covered = new Set();
  for (const slice of tableSlices) {
    for (const cp of slice) if (!isExcluded(cp)) covered.add(cp);
  }
  const all = new Set(tableSlices.flat());
  coverage[family.id] = toRanges([...covered]);
  provenance.families[family.id] = {
    label: family.coverageFamily,
    url,
    slices: tableSlices.length,
    codepointsInTable: all.size,
    codepointsKept: covered.size,
    codepointsExcluded: all.size - covered.size,
  };
  log(
    `${family.coverageFamily}: ${tableSlices.length} slices, ${all.size} codepoints ` +
      `(-${all.size - covered.size} emoji/symbol) -> ${coverage[family.id].length} range strings`,
  );
}

const target = join(import.meta.dirname, 'ranges.json');
writeFileSync(target, `${JSON.stringify({ provenance, coverage }, null, 2)}\n`);
log(`\nwrote ${target}`);
for (const [id, ranges] of Object.entries(coverage)) {
  log(`  ${id}: ${parseRanges(ranges.join(',')).length} codepoints`);
}
