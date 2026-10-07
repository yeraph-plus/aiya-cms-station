import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Style guard (DESIGN.md §3 守卫 + UX.md 判据的常驻执法): the convergence
 * rules the review audits check by hand, enforced on every `vitest run`.
 * Each rule names its escape hatch explicitly — a violation is a diff away,
 * not a discussion.
 */

const ROOT = join(import.meta.dirname, '..');

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, exts));
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

// path.relative + sep split: on POSIX the naive "strip ROOT + '\\'" prefix
// never matches, keys stay absolute, and every startsWith/set filter below
// silently misses (the CI-only style-guard failures this replaced).
const rel = (p: string) => relative(ROOT, p).split(sep).join('/');

function scan(dirs: string[], exts: string[]): Map<string, string> {
  const files = new Map<string, string>();
  for (const dir of dirs) {
    for (const full of walk(join(ROOT, dir), exts)) {
      files.set(rel(full), readFileSync(full, 'utf-8'));
    }
  }
  return files;
}

const SRC = ['src'];
const TS_ASTRO = ['.ts', '.tsx', '.astro'];

function violations(files: Map<string, string>, rx: RegExp): string[] {
  const hits: string[] = [];
  for (const [file, text] of files) {
    if (rx.test(text)) hits.push(file);
  }
  return hits.sort();
}

/** Files that are deliberately dependency-free or backend-driven and carry
    their own colors (DESIGN.md §1: design decisions, not oversights). */
const HEX_ALLOWLIST = new Set([
  'src/lib/gate.ts',
  'src/pages/500.astro',
  'src/lib/theme.ts',
  'src/lib/page.server.ts',
]);

/** The one documented color-literal exemption: the image-strip delete
    button's on-thumbnail scrim (RichEditor, UX.md §3 图上元素豁免). */
const COLOR_LITERAL_ALLOWLIST = new Set(['src/components/islands/user-center/RichEditor.tsx']);

describe('style guard', () => {
  it('rounded-xl stays inside ui/ (the 6px scale rule, HISTORY.md §二#6#24)', () => {
    const files = new Map(
      [...scan(SRC, TS_ASTRO)].filter(([f]) => !f.startsWith('src/components/ui/')),
    );
    expect(violations(files, /rounded-xl/)).toEqual([]);
  });

  it('min-[1440px] never appears (Tailwind v4 does not generate it)', () => {
    expect(violations(scan(SRC, TS_ASTRO), /min-\[1440px\]/)).toEqual([]);
  });

  it('viewport-height caps use svh, never vh', () => {
    expect(violations(scan(SRC, TS_ASTRO), /max-h-\[\d+vh\]/)).toEqual([]);
  });

  it('repeated container widths ride the named tokens', () => {
    expect(violations(scan(SRC, TS_ASTRO), /max-w-\[1510px\]|max-w-\[380px\]/)).toEqual([]);
  });

  it('scrim literals stay out of islands (the two-step --scrim tokens)', () => {
    const files = new Map(
      [...scan(['src/components/islands'], ['.tsx'])].filter(
        ([f]) => !COLOR_LITERAL_ALLOWLIST.has(f),
      ),
    );
    expect(violations(files, /bg-black\/|from-black\/|via-black\/|rgba\(15,\s*15,\s*20/)).toEqual(
      [],
    );
  });

  it('hex colors stay on the dependency-free whitelist (brand colors ride tokens)', () => {
    const hexed = [...scan(SRC, ['.astro', '.tsx'])]
      .filter(([f]) => !HEX_ALLOWLIST.has(f))
      .filter(([, text]) =>
        /#[0-9a-fA-F]{3,8}\b/.test(
          text.replace(/https?:\/\/[^\s"'<)]*/g, '').replace(/&#x?[0-9a-fA-F]+;/g, ''),
        ),
      );
    expect(hexed).toEqual([]);
  });

  it('the letter-fallback avatar has exactly one recipe', () => {
    const files = new Map(
      [...scan(['src/components/islands'], ['.tsx'])].filter(
        ([f]) => f !== 'src/components/islands/Avatar.tsx',
      ),
    );
    expect(violations(files, /slice\(0, 1\)/)).toEqual([]);
  });

  it('error-code lookups go through lib/feedback (no hand-rolled tables)', () => {
    expect(
      violations(
        scan(['src/components/islands'], ['.tsx']),
        /\.errors as Record<string, string \| undefined>/,
      ),
    ).toEqual([]);
  });

  it('lucide-static stays server-side (islands take icons as props, termIconMap)', () => {
    // The dynamic namespace import defeats tree-shaking: one island import
    // of lib/icons put the whole ~2000-icon SVG table (~1MB) into the
    // client bundle. Resolution happens server-side; islands render props.
    expect(
      violations(scan(['src/components/islands'], ['.tsx']), /from ['"]@\/lib\/icons['"]/),
    ).toEqual([]);
  });

  it('the three converged bare inputs keep their labels pinned', () => {
    const cs = readFileSync(join(ROOT, 'src/components/islands/CommentSection.tsx'), 'utf-8');
    expect(cs).toContain('aria-label={copy.guestName}');
    expect(cs).toContain('aria-label={copy.guestEmail}');
    const rich = readFileSync(
      join(ROOT, 'src/components/islands/user-center/RichEditor.tsx'),
      'utf-8',
    );
    expect(rich).toContain('aria-label={labels.title}');
  });

  it('durations ride the named motion tokens (ui/ keeps shadcn upstream)', () => {
    // Component layer: semantic duration-* utilities only — numeric scales
    // (duration-200) drift off the fast/base/slow vocabulary and arbitrary
    // values (duration-[…]) bypass it entirely.
    const comp = new Map(
      [...scan(SRC, TS_ASTRO)].filter(([f]) => !f.startsWith('src/components/ui/')),
    );
    expect(
      violations(
        comp,
        /[^a-z-]duration-\d|duration-\[\d|\[transition-duration:|\[animation-duration:/,
      ),
    ).toEqual([]);
    // Shell CSS: transition declarations read the --transition-duration-*
    // vars; the route-progress loop period (an animation shorthand, not a
    // motion-token duration) is the one documented exception (DESIGN.md §2 动效).
    const css = new Map(
      [...scan(['src/styles'], ['.css'])].filter(([f]) => f !== 'src/styles/tokens.css'),
    );
    expect(violations(css, /(?:^|[^-])transition[^;:]*:[^;]*\d+\.?\d*m?s/)).toEqual([]);
  });

  it('font stacks ride the tokens, MiSans opens display and body (DESIGN.md §2 字体栈)', () => {
    // Handwritten font-family literals drift off the single webfont stack;
    // tokens.css is the only source, gate/500 keep their inline
    // dependency-free stacks (the hex-allowlist zero-dep pages minus the
    // two that carry no fonts).
    const files = new Map(
      [...scan(SRC, TS_ASTRO)].filter(
        ([f]) =>
          f !== 'src/styles/tokens.css' && f !== 'src/lib/gate.ts' && f !== 'src/pages/500.astro',
      ),
    );
    expect(violations(files, /font-family|font-\[/)).toEqual([]);
    // The webfont decision itself: self-hosted MiSans must stay the first
    // family of both text stacks (AppShell imports Regular + Medium css).
    const tokens = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf-8');
    for (const token of ['--font-display', '--font-body']) {
      const line = tokens.split('\n').find((candidate) => candidate.trim().startsWith(`${token}:`));
      expect(line?.includes(`'MiSans',`)).toBe(true);
      expect(line?.indexOf(`'MiSans'`)).toBeLessThan(line?.indexOf(`'PingFang SC'`) ?? NaN);
    }
  });
});
