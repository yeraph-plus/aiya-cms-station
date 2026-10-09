import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

const sha256 = (body: string) =>
  'sha256-' + createHash('sha256').update(body, 'utf8').digest('base64');

/** `<script is:inline>` bodies are the author's to vouch for, so the CSP
 *  hashes for them live in astro.config.mjs. This test fails when a body is
 *  edited and the hash is not carried across with it. */
describe('CSP inline script hashes', () => {
  it('lists exactly the hashes of the hand-written inline scripts', () => {
    const config = readFileSync(new URL('astro.config.mjs', `file://${root}`), 'utf8');

    const arrays = [...config.matchAll(/hashes:\s*\[([\s\S]*?)\]/g)].map((m) => m[1]);
    expect(arrays.length, 'expected one hashes array in astro.config.mjs').toBe(1);
    const declared = [...arrays[0].matchAll(/["'](sha256-[A-Za-z0-9+/=]+)["']/g)].map((m) => m[1]);
    expect(declared.length, 'hashes array is empty').toBeGreaterThan(0);

    // Comments hold `<script ...>` snippets too, and the gtag.js loader is a
    // self-closing tag; drop both so neither is mistaken for a real script.
    const source = readFileSync(
      new URL('src/components/layout/BaseHead.astro', `file://${root}`),
      'utf8',
    )
      .replace(/\r\n/g, '\n')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

    const bodies: string[] = [];
    for (const m of source.matchAll(/<script(?![^>]*\/>)([^>]*)>([\s\S]*?)<\/script>/g)) {
      const [, attrs, body] = m;
      if (attrs.includes('application/ld+json')) continue; // data block, not script
      bodies.push(body);
    }

    expect(bodies.length, 'expected the pre-paint and gtag inline scripts').toBe(2);

    const computed = bodies.map(sha256);
    for (const [i, hash] of computed.entries()) {
      expect(
        declared,
        `inline script #${i + 1} has hash ${hash} but astro.config.mjs declares ${declared.join(', ')}`,
      ).toContain(hash);
    }
    expect([...declared].sort()).toEqual([...computed].sort());
  });
});
