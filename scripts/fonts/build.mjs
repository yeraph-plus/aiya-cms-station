#!/usr/bin/env node
/**
 * Font slice builder (DESIGN.md §2 字体栈).
 *
 * Turns the cached upstream OTFs into the woff2 slices this repo ships, one
 * family per language:
 *
 *   Station Sans SC   Simplified pages — the front blocks plus the
 *                     frequency-ranked characters (the default stack)
 *   Station Sans TC   the zh-Hant forms that actually differ from SC
 *   Station Sans JP   the Japanese forms that actually differ from SC,
 *                     Japanese-only kanji included
 *
 * Coverage per family comes from scripts/fonts/ranges.json (a snapshot of the
 * official Google Fonts slice table for that family), slice *order* from
 * scripts/fonts/order.json (a most-used-first character list), and the glyphs
 * from the upstream per-language OTF fetched by scripts/fonts/fetch.mjs.
 *
 * Why TC/JP are deltas: the three upstream language builds share most
 * outlines. Shipping the full Traditional (16.7k) and Japanese (17.9k) tables
 * would repeat ~2.5 MB per weight for glyphs that are byte-identical to the
 * Simplified family's, and a zh-Hant page would still have to load the SC
 * family for anything the TC table lacks. Comparing outlines per codepoint
 * and shipping only the differing ones keeps every regional form correct
 * while the identical majority is served once, from SC.
 *
 * Ordering is the payload contract: the first slices hold what almost every
 * page needs (Latin, punctuation, kana) followed by the most-used CJK
 * characters, so a normal page pulls a handful of small slices instead of
 * most of the font. Google's own table order is block-based and would make a
 * Chinese page pull ~45% of the coverage.
 *
 *   node scripts/fonts/build.mjs                      # every family, 140-codepoint slices
 *   node scripts/fonts/build.mjs --families=sc        # iterate on one family
 *   node scripts/fonts/build.mjs --slice-size=100     # finer slices, more files
 *   node scripts/fonts/build.mjs --keep-hinting       # keep upstream hinting (bigger)
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import * as fontkitNs from 'fontkit';
import { chunk, parseRanges, toRanges, toText } from './lib.mjs';

const fontkit = fontkitNs.default ?? fontkitNs;

const ROOT = join(import.meta.dirname, '..', '..');
const CACHE = join(ROOT, '.cache', 'fonts');
const OUT_ROOT = join(ROOT, 'src', 'fonts', 'station-sans');
const WORKER = join(import.meta.dirname, 'subset-worker.mjs');
const REFERENCE = 'sc'; // family every other family is diffed against

/** Blocks that belong in the always-needed front slices, in this order. */
const EARLY_BLOCKS = [
  [0x0020, 0x00ff], // basic latin, latin-1 supplement
  [0x0100, 0x024f], // latin extended A/B
  [0x2000, 0x206f], // general punctuation
  [0x2070, 0x209f], // super/subscripts
  [0x20a0, 0x20cf], // currency symbols
  [0x2100, 0x214f], // letterlike symbols
  [0x2150, 0x218f], // number forms
  [0x2190, 0x21ff], // arrows
  [0x2200, 0x22ff], // mathematical operators
  [0x2460, 0x24ff], // enclosed alphanumerics
  [0x25a0, 0x25ff], // geometric shapes
  [0x3000, 0x303f], // CJK symbols and punctuation
  [0x3040, 0x30ff], // kana (hiragana 3041-3096, katakana 30a1-30fa, 30fb-30fc)
  [0x3100, 0x312f], // bopomofo
  [0xfe10, 0xfe4f], // vertical/compact CJK forms
  [0xff00, 0xffef], // halfwidth and fullwidth forms
];

/**
 * The slices every page shares: ASCII, general punctuation and CJK
 * punctuation. They open the order so that a page made of prose pulls these
 * two slices plus only the CJK slices its own characters sit in — putting the
 * whole EARLY_BLOCKS group first would instead make every Chinese page carry
 * ~10 slices of Latin, kana and symbol blocks it never renders.
 */
const CORE_BLOCKS = [
  [0x0020, 0x007e], // printable ASCII
  [0x2000, 0x206f], // general punctuation
  [0x3000, 0x303f], // CJK symbols and punctuation
];

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, value] = arg.slice(2).split('=');
      return [key, value ?? 'true'];
    }),
);

const sources = JSON.parse(readFileSync(join(import.meta.dirname, 'sources.json'), 'utf-8'));
const SLICE_SIZE = Number(
  args.get('slice-size') ?? process.env.FONTS_SLICE_SIZE ?? sources.subset.sliceSize,
);
const KEEP_HINTING = args.get('keep-hinting') === 'true';
const ONLY = args.get('families')?.split(',');
const WORKERS = Number(
  args.get('workers') ?? Math.min(6, Math.max(2, (process.env.NUMBER_OF_PROCESSORS ?? 4) - 2)),
);

function log(message) {
  process.stderr.write(`${message}\n`);
}

function subsetAll(tasks, workers) {
  const results = new Array(tasks.length);
  let next = 0;
  const runWorker = () =>
    new Promise((resolve, reject) => {
      const worker = new Worker(WORKER);
      worker.on('error', reject);
      const step = () => {
        const index = next;
        next += 1;
        if (index >= tasks.length) {
          void worker.terminate();
          resolve();
          return;
        }
        worker.once('message', (message) => {
          if (message.error) {
            void worker.terminate();
            reject(new Error(`slice ${index}: ${message.error}`));
            return;
          }
          results[index] = message.buffer;
          step();
        });
        worker.postMessage({ index, ...tasks[index] });
      };
      step();
    });
  return Promise.all(Array.from({ length: workers }, runWorker)).then(() => results);
}

/** Hash of a glyph's outline, so the same shape in two builds compares equal. */
function outlineHash(font, codepoint) {
  const glyph = font.glyphForCodePoint(codepoint);
  if (!glyph?.path?.commands?.length) return 'none';
  return createHash('sha1').update(JSON.stringify(glyph.path.commands)).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------- partition
const { provenance: rangeProvenance, coverage } = JSON.parse(
  readFileSync(join(import.meta.dirname, 'ranges.json'), 'utf-8'),
);
const { provenance: orderProvenance, ranked } = JSON.parse(
  readFileSync(join(import.meta.dirname, 'order.json'), 'utf-8'),
);
const priority = parseRanges(ranked.join(','));

/** Core blocks, then the frequency-ranked characters, then the remaining
    front blocks, then everything else in code order. */
function partition(covered) {
  const taken = new Set();
  const group = (blocks) => {
    const out = [];
    for (const [start, end] of blocks) {
      for (let cp = start; cp <= end; cp += 1) {
        if (covered.has(cp) && !taken.has(cp)) {
          out.push(cp);
          taken.add(cp);
        }
      }
    }
    return out;
  };
  const core = group(CORE_BLOCKS);
  const frequent = priority.filter((cp) => covered.has(cp) && !taken.has(cp));
  for (const cp of frequent) taken.add(cp);
  const blocks = group(EARLY_BLOCKS);
  const rest = [...covered].filter((cp) => !taken.has(cp)).sort((a, b) => a - b);
  return {
    slices: [core, frequent, blocks, rest],
    counts: {
      core: core.length,
      frequent: frequent.length,
      blocks: blocks.length,
      rest: rest.length,
    },
  };
}

function tableOf(family) {
  return new Set(parseRanges(coverage[family.id].join(',')));
}

/** Core and front blocks plus the frequency list, restricted to the family's table. */
function commonCoverage(table) {
  const set = new Set();
  for (const [start, end] of EARLY_BLOCKS) {
    for (let cp = start; cp <= end; cp += 1) if (table.has(cp)) set.add(cp);
  }
  for (const cp of priority) if (table.has(cp)) set.add(cp);
  return set;
}

/**
 * Codepoints whose glyphs the reference family cannot stand in for: absent
 * from it, or drawn differently there. Computed per weight and unioned, so a
 * form that differs in any weight ships.
 */
function deltaCoverage(family, referenceFonts) {
  const table = tableOf(family);
  const set = new Set();
  for (const weight of family.weights) {
    const font = fontkit.openSync(join(CACHE, weight.file));
    const reference = referenceFonts.get(weight.name);
    for (const cp of table) {
      if (set.has(cp)) continue;
      const mine = outlineHash(font, cp);
      if (mine === 'none') continue;
      const theirs = outlineHash(reference, cp);
      if (mine !== theirs) set.add(cp);
    }
  }
  return set;
}

// ------------------------------------------------------------------- build
mkdirSync(OUT_ROOT, { recursive: true });
const summary = [];

const referenceFamily = sources.families.find((family) => family.id === REFERENCE);
const referenceFonts = new Map(
  referenceFamily.weights.map((weight) => [
    weight.name,
    fontkit.openSync(join(CACHE, weight.file)),
  ]),
);
const referenceTable = tableOf(referenceFamily);

for (const family of sources.families) {
  if (ONLY && !ONLY.includes(family.id)) continue;
  const isReference = family.id === REFERENCE;
  const covered = isReference
    ? commonCoverage(referenceTable)
    : deltaCoverage(family, referenceFonts);
  const { slices: groups, counts } = partition(covered);
  const slices = groups.flatMap((group) => chunk(group, SLICE_SIZE));
  const coverageMeta = rangeProvenance.families[family.id];
  log(
    `\n${family.family}: ${covered.size} codepoints -> ${slices.length} slices of <=${SLICE_SIZE}` +
      ` (core ${counts.core}, ranked ${counts.frequent}, blocks ${counts.blocks}, rest ${counts.rest})`,
  );
  log(
    isReference
      ? `  core and front blocks + frequency list, restricted to Google's ${coverageMeta.label} table`
      : `  ${coverageMeta.label} table minus glyphs identical to ${referenceFamily.family}`,
  );
  log(`  order: ${orderProvenance.source}`);

  const out = join(OUT_ROOT, family.id);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  for (const weight of family.weights) {
    const file = join(CACHE, weight.file);
    const font = fontkit.openSync(file);
    const tasks = [];
    let dropped = 0;
    for (const slice of slices) {
      const supported = slice.filter((cp) => font.hasGlyphForCodePoint(cp));
      dropped += slice.length - supported.length;
      if (!supported.length) continue; // coverage and source disagree; emit no empty slice
      tasks.push({
        file,
        text: toText(supported),
        options: {
          targetFormat: 'woff2',
          noHinting: !KEEP_HINTING,
          keepFeatures: sources.subset.keepFeatures,
          dropTables: sources.subset.dropTables,
        },
        ranges: toRanges(supported).join(','),
      });
    }

    log(`  ${weight.name}: subsetting ${tasks.length} slices with ${WORKERS} workers…`);
    const started = Date.now();
    const buffers = await subsetAll(tasks, WORKERS);

    const rules = [];
    let bytes = 0;
    const sizes = [];
    const stem = `${family.family.replaceAll(' ', '')}-${weight.name}`;
    tasks.forEach((task, index) => {
      const buffer = buffers[index];
      const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 8);
      const name = `${stem}.${hash}.${index}.woff2`;
      writeFileSync(join(out, name), buffer);
      bytes += buffer.length;
      sizes.push(buffer.length);
      rules.push(
        `@font-face{font-family:'${family.family}';font-style:normal;font-weight:${weight.css};font-display:swap;src:url(./${name}) format('woff2');unicode-range:${task.ranges}}`,
      );
    });

    const originLine = isReference
      ? ' * restricted to the front blocks plus the frequency list (scripts/fonts/order.json);'
      : ` * restricted to the glyphs that differ from ${referenceFamily.family}; the identical majority`;
    const originTail = isReference
      ? ' * order: most-used first.'
      : ` * comes from ${referenceFamily.family}; order: most-used first.`;
    const header = [
      '/* GENERATED by scripts/fonts/build.mjs — do not edit by hand.',
      ` * ${family.family} ${weight.name} (css weight ${weight.css}) — ${rules.length} slices subsetted from`,
      ` * ${sources.upstream.font}, ${sources.upstream.repo} (${sources.upstream.license.id});`,
      ` * coverage: Google's ${coverageMeta.label} slice table,`,
      originLine,
      originTail,
      ` * Generated ${new Date().toLocaleDateString('sv-SE')} by scripts/fonts/build.mjs.`,
      ' */',
    ].join('\n');
    const cssFile = `${stem}.min.css`;
    writeFileSync(join(out, cssFile), `${header}\n${rules.join('\n')}\n`);

    sizes.sort((a, b) => a - b);
    summary.push({
      family: family.id,
      weight: weight.name,
      slices: rules.length,
      bytes,
      css: readFileSync(join(out, cssFile)).length,
      median: sizes[Math.floor(sizes.length / 2)],
      max: sizes.at(-1),
      dropped,
      seconds: ((Date.now() - started) / 1000).toFixed(1),
    });
  }
}

log('\nfamily weight    slices     total woff2      css   per-slice median/max   dropped  time');
for (const row of summary) {
  log(
    `${row.family.padEnd(6)} ${row.weight.padEnd(9)} ${String(row.slices).padStart(6)} ` +
      `${(row.bytes / 1024 / 1024).toFixed(2).padStart(12)} MB ${(row.css / 1024).toFixed(0).padStart(6)} KB ` +
      `${(row.median / 1024).toFixed(1).padStart(12)}/${(row.max / 1024).toFixed(1).padStart(5)} KB ` +
      `${String(row.dropped).padStart(8)} ${row.seconds.padStart(6)}s`,
  );
}
let files = 0;
let bytes = 0;
for (const family of sources.families) {
  const dir = join(OUT_ROOT, family.id);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.woff2'))) {
    files += 1;
    bytes += readFileSync(join(dir, name)).length;
  }
}
log(`\n${files} woff2 files, ${(bytes / 1024 / 1024).toFixed(2)} MB total, in ${OUT_ROOT}`);
