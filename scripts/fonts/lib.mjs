/**
 * Shared helpers for the font pipeline (scripts/fonts/*.mjs).
 *
 * Ranges are plain "U+XXXX" / "U+XXXX-YYYY" strings (CSS `unicode-range`
 * syntax); codepoints are numbers. Every conversion keeps ranges sorted and
 * disjoint so no two @font-face slices ever claim the same codepoint.
 */
import { execFileSync } from 'node:child_process';

/** Chrome UA: the Google Fonts css2 API only returns the sliced woff2 table
    (with unicode-range) for a modern browser UA; anything else gets one
    monolithic TTF per weight without ranges. */
export const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Codepoints a font/web layer must never be asked for: surrogates,
    noncharacters and anything past the last plane. */
export function isUsableCodepoint(cp) {
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) return false;
  if (cp >= 0xd800 && cp <= 0xdfff) return false;
  if (cp >= 0xfdd0 && cp <= 0xfdef) return false;
  if ((cp & 0xffff) === 0xfffe || (cp & 0xffff) === 0xffff) return false;
  return true;
}

export function formatRange(start, end) {
  const hex = (value) => `U+${value.toString(16).toUpperCase()}`;
  return start === end ? hex(start) : `${hex(start)}-${end.toString(16).toUpperCase()}`;
}

/** "U+4E00-4E05,U+3001" -> [0x4e00..0x4e05, 0x3001, …] (usable ones only). */
export function parseRanges(css) {
  const out = [];
  for (const part of css.split(',')) {
    const token = part.trim();
    const match = /^U\+([0-9A-Fa-f?]{1,6})(?:-([0-9A-Fa-f]{1,6}))?$/.exec(token);
    if (!match) continue;
    let start;
    let end;
    if (match[1].includes('?')) {
      start = Number.parseInt(match[1].replaceAll('?', '0'), 16);
      end = Number.parseInt(match[1].replaceAll('?', 'F'), 16);
    } else {
      start = Number.parseInt(match[1], 16);
      end = match[2] ? Number.parseInt(match[2], 16) : start;
    }
    for (let cp = start; cp <= end; cp += 1) {
      if (isUsableCodepoint(cp)) out.push(cp);
    }
  }
  return out;
}

/** Sorted, disjoint, merged range strings for a codepoint list. */
export function toRanges(codepoints) {
  const sorted = [...new Set(codepoints)].sort((a, b) => a - b);
  const ranges = [];
  let start = null;
  let previous = null;
  for (const cp of sorted) {
    if (start === null) {
      start = cp;
    } else if (cp !== previous + 1) {
      ranges.push(formatRange(start, previous));
      start = cp;
    }
    previous = cp;
  }
  if (start !== null) ranges.push(formatRange(start, previous));
  return ranges;
}

/** The characters a subset call keeps: codepoints as one JS string. */
export function toText(codepoints) {
  return [...new Set(codepoints)]
    .sort((a, b) => a - b)
    .map((cp) => String.fromCodePoint(cp))
    .join('');
}

/** Split a codepoint list into chunks of at most `size`, keeping the input
    order (slice order is the payload contract, not a detail to sort away). */
export function chunk(codepoints, size) {
  const ordered = [...new Set(codepoints)];
  const chunks = [];
  for (let index = 0; index < ordered.length; index += size) {
    chunks.push(ordered.slice(index, index + size));
  }
  return chunks;
}

/** GET a URL as text. curl keeps proxy support (Node's fetch has none). */
export function fetchText(url, userAgent) {
  const proxy = process.env.FONTS_PROXY ?? process.env.HTTPS_PROXY ?? '';
  const args = ['-fsSL', '--retry', '3', '--retry-delay', '2', '--connect-timeout', '20'];
  if (proxy) args.push('-x', proxy);
  if (userAgent) args.push('-A', userAgent);
  args.push(url);
  return execFileSync(process.env.FONTS_CURL ?? 'curl', args, { encoding: 'utf-8' });
}
