#!/usr/bin/env node
/**
 * Font source fetcher (DESIGN.md §2 字体栈).
 *
 * Downloads the upstream per-language Noto Sans CJK OTFs listed in
 * sources.json into the gitignored .cache/fonts/, then verifies size and
 * sha256. `scripts/fonts/build.mjs` subsets those files into the woff2
 * slices that ship with the repo, so the source fonts themselves are never
 * versioned and a normal build needs no network at all.
 *
 * Mirrors are tried in order: cdn.jsdelivr.net first (reachable from
 * mainland China without a proxy), then raw.githubusercontent.com.
 *
 *   node scripts/fonts/fetch.mjs                 # skip files already cached
 *   node scripts/fonts/fetch.mjs --force         # re-download everything
 *   node scripts/fonts/fetch.mjs --families=sc   # only one family
 *
 * The download shells out to curl because Node's global fetch has no proxy
 * support; set FONTS_PROXY (e.g. http://127.0.0.1:10808) when the network
 * needs one. When curl is unavailable the script falls back to fetch().
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const CACHE = join(ROOT, '.cache', 'fonts');
const SOURCES = JSON.parse(readFileSync(join(import.meta.dirname, 'sources.json'), 'utf-8'));
const FORCE = process.argv.includes('--force');
const ONLY = process.argv
  .find((arg) => arg.startsWith('--families='))
  ?.slice('--families='.length)
  .split(',');

function log(message) {
  process.stderr.write(`${message}\n`);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function download(url, target) {
  const proxy = process.env.FONTS_PROXY ?? process.env.HTTPS_PROXY ?? '';
  const args = ['-fL', '--retry', '3', '--retry-delay', '2', '--connect-timeout', '20'];
  if (proxy) args.push('-x', proxy);
  args.push('-o', target, url);
  try {
    execFileSync(process.env.FONTS_CURL ?? 'curl', args, {
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    return 'curl';
  } catch (error) {
    if (process.env.FONTS_CURL) throw error;
    log(`  curl failed (${error.message.trim().split('\n')[0]}); falling back to fetch()`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    return 'fetch';
  }
}

mkdirSync(CACHE, { recursive: true });
let failed = 0;

/** A cache entry only counts when it still matches the pinned size and hash. */
function verified(file, weight) {
  if (!existsSync(file)) return false;
  const { size } = statSync(file);
  return size === weight.bytes && (!weight.sha256 || sha256(file) === weight.sha256);
}

for (const family of SOURCES.families) {
  if (ONLY && !ONLY.includes(family.id)) continue;
  for (const weight of family.weights) {
    const target = join(CACHE, weight.file);
    if (!FORCE && verified(target, weight)) {
      log(`${family.id}/${weight.name}: cached ${weight.file}`);
    } else {
      const urls = SOURCES.upstream.mirrors.map(
        (mirror) => `${mirror}/${SOURCES.upstream.path}/${family.subdir}/${weight.file}`,
      );
      for (const [index, url] of urls.entries()) {
        try {
          log(`${family.id}/${weight.name}: downloading ${url}`);
          const via = await download(url, target);
          log(`  done via ${via}`);
          break;
        } catch (error) {
          const message = String(error.message ?? error)
            .trim()
            .split('\n')[0];
          if (index === urls.length - 1) {
            log(`  FAILED: ${message}`);
            failed += 1;
          } else {
            log(`  mirror failed (${message}); trying next`);
          }
        }
      }
      if (!existsSync(target)) continue;
    }

    const { size } = statSync(target);
    const hash = sha256(target);
    const sizeOk = size === weight.bytes;
    const hashOk = !weight.sha256 || hash === weight.sha256;
    log(
      `  ${sizeOk ? 'ok' : 'SIZE MISMATCH'} ${size} bytes (expected ${weight.bytes})` +
        ` sha256=${hash}${weight.sha256 ? (hashOk ? ' (pinned)' : ' HASH MISMATCH') : ' (unpinned)'}`,
    );
    if (!sizeOk || !hashOk) failed += 1;
  }
}

if (failed) {
  log(`\n${failed} source(s) failed verification.`);
  process.exit(1);
}
log(`\nSources ready in ${CACHE}`);
