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

  it('font stacks ride the tokens, Station Sans opens display and body (DESIGN.md §2 字体栈)', () => {
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

    const tokens = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf-8');
    const compact = (text: string) => text.replace(/\s+/g, ' ');
    // The webfont decision itself: the Simplified family leads both text
    // stacks, the Hant and Japanese families sit behind it (a page pulls one
    // family's slices plus only the other families' differing glyphs), and
    // the system faces for all three scripts stay in the chain for codepoints
    // no slice covers.
    const BASE = [
      "'Station Sans SC'",
      "'Station Sans TC'",
      "'Station Sans JP'",
      "'PingFang SC'",
      "'PingFang TC'",
      "'Hiragino Sans'",
      "'Microsoft YaHei'",
      "'Microsoft JhengHei'",
      "'Yu Gothic UI'",
      "'Noto Sans CJK SC'",
      "'Noto Sans CJK TC'",
      "'Noto Sans CJK JP'",
      'system-ui',
      'sans-serif',
    ].join(', ');
    for (const token of ['--font-display', '--font-body']) {
      // prettier wraps the long value across lines, so read the whole
      // declaration instead of the first physical line.
      const match = new RegExp(`${token}:\\s*([^;]+);`).exec(compact(tokens));
      const stack = match?.[1]?.trim() ?? '';
      expect(stack.startsWith(`'Station Sans SC',`)).toBe(true);
      expect(stack.indexOf(`'Station Sans SC'`)).toBeLessThan(stack.indexOf(`'Station Sans TC'`));
    }
    // Three copies, one base stack: the dependency-free gate and 500 pages
    // inline exactly what the tokens declare (they carry no webfont, so their
    // fallbacks have to be the same list).
    expect(compact(tokens)).toContain(BASE);
    expect(compact(readFileSync(join(ROOT, 'src/lib/gate.ts'), 'utf-8'))).toContain(BASE);
    expect(compact(readFileSync(join(ROOT, 'src/pages/500.astro'), 'utf-8'))).toContain(BASE);

    // Regional forms come from reordering the families, not from `locl`:
    // each block must put its own family first and keep that script's system
    // faces behind it.
    const blockOf = (selector: string) => {
      const match = new RegExp(`${selector}[^{]*\\{([^}]*)\\}`).exec(tokens);
      expect(match, `missing ${selector} block`).not.toBeNull();
      return compact(match?.[1] ?? '');
    };
    const hant = blockOf(':lang\\(zh-Hant\\)');
    expect(hant).toContain("--font-display: 'Station Sans TC'");
    expect(hant).toContain("'Station Sans TC', 'Station Sans SC'");
    for (const face of ["'PingFang TC'", "'Microsoft JhengHei'", "'Noto Sans CJK TC'"]) {
      expect(hant).toContain(face);
    }
    const japanese = blockOf(':lang\\(ja\\)');
    expect(japanese).toContain("--font-body: 'Station Sans JP'");
    expect(japanese).toContain("'Station Sans JP', 'Station Sans SC'");
    for (const face of ["'Hiragino Sans'", "'Yu Gothic UI'", "'Noto Sans CJK JP'"]) {
      expect(japanese).toContain(face);
    }

    // The wiring: the shell imports all three families' two weights, which is
    // what puts the slices in the build at all (a family left out here would
    // silently fall back to system faces).
    const shell = readFileSync(join(ROOT, 'src/components/layout/AppShell.astro'), 'utf-8');
    for (const [id, stem] of [
      ['sc', 'StationSansSC'],
      ['tc', 'StationSansTC'],
      ['jp', 'StationSansJP'],
    ]) {
      for (const weight of ['Regular', 'Medium']) {
        expect(shell).toContain(`@/fonts/station-sans/${id}/${stem}-${weight}.min.css`);
      }
    }
  });

  it('the article body declares one block step for text blocks and parts (DESIGN.md §2 正文节奏)', () => {
    // The rhythm lives in exactly one declaration list: every text block and
    // every backend template part rides --prose-gap-block, so a part can no
    // longer invent a margin of its own (alert/collapse sat at 0 while the
    // related-post card sat at 1rem and col_list inherited 1.25em).
    // Comments first: a preceding comment is not part of a rule's selector,
    // and its prose ("…margin used to push…") would otherwise read as a
    // declaration.
    const css = readFileSync(join(ROOT, 'src/styles/shell.css'), 'utf-8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    const blocks = css.match(/[^{}]+\{[^{}]*\}/g) ?? [];
    const rhythm = blocks.filter((block) => block.includes('margin-block: var(--prose-gap-block)'));
    const declared = rhythm.join('\n');
    for (const selector of [
      '.prose-content ul',
      '.prose-content ol',
      '.prose-content blockquote',
      '.prose-content pre',
      '.prose-content table',
      '.prose-content figure',
      '.prose-content dl',
      '.prose-content details',
      '.prose-content alert',
      '.prose-content [data-post-card]',
      '.prose-content a.part-button',
      '.prose-content span[data-clipboard-slot]',
      '.prose-content img',
    ]) {
      expect(declared, `${selector} must ride the block step`).toContain(selector);
    }
    // …and no part carries a literal margin behind the family step: the only
    // margin a part block may declare is zero (its inner first/last reset) or
    // one of the two rhythm tokens.
    const PART =
      /\.prose-content (?:alert|details|dl|a\.part-button|span\[data-clipboard-slot\]|\[data-post-card\])/;
    const OFF_SCALE =
      /^(?:margin|margin-block|margin-top|margin-bottom):(?:0|var\(--prose-gap-(?:text|block)\))$/;
    const literals = blocks
      .filter(
        (block) =>
          !block.includes('summary') &&
          !block.includes('::before') &&
          !block.includes('::after') &&
          PART.test(block),
      )
      .flatMap((block) => block.match(/margin[^:;]*:[^;}]+/g) ?? [])
      .map((declaration) => declaration.replace(/\s+/g, ''))
      .filter((declaration) => !OFF_SCALE.test(declaration));
    expect(literals).toEqual([]);
  });

  it('the prose container recipe has one source (the unlocked body shares it)', () => {
    // A second, hand-rolled `prose-content` string is how the unlocked body
    // ended up with no typography at all (no heading scale, no list markers,
    // no paragraph gaps) — the class may only be assembled in lib/prose.ts.
    const files = new Map([...scan(SRC, TS_ASTRO)].filter(([f]) => f !== 'src/lib/prose.ts'));
    expect(violations(files, /prose-content/)).toEqual([]);
  });
});
