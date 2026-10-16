import { describe, expect, it } from 'vitest';

import { CATEGORY_CHIP_CAP, nextCategorySelection, splitCategoryChips } from '@/lib/filters';

/**
 * The category table is presented in two rows (the toolbar's volume window
 * and the filter panel's tail) while staying one single-select filter. Both
 * rules below are the shared source the island renders from, so a drift here
 * would show up as a chip row that disagrees with its panel row.
 */

const ALL = { slug: '', name: '全部' };

function chips(counts: number[]): Array<{ slug: string; name: string; count?: number }> {
  return [
    ALL,
    ...counts.map((count, index) => ({
      slug: `term-${index + 1}`,
      name: `分类 ${index + 1}`,
      count,
    })),
  ];
}

describe('splitCategoryChips', () => {
  it('keeps the "all" chip first and the busiest terms after it', () => {
    const { toolbar } = splitCategoryChips(chips([3, 9, 1]));
    expect(toolbar.map((chip) => chip.slug)).toEqual(['', 'term-2', 'term-1', 'term-3']);
  });

  it('cuts the table at the cap and hands the tail to the panel', () => {
    const counts = Array.from({ length: 20 }, (_, index) => 100 - index);
    const { toolbar, panel } = splitCategoryChips(chips(counts));
    expect(toolbar).toHaveLength(CATEGORY_CHIP_CAP + 1); // "all" + the window
    expect(toolbar.slice(1).map((chip) => chip.slug)).toEqual(
      Array.from({ length: 12 }, (_, index) => `term-${index + 1}`),
    );
    // The panel carries the remainder, still busiest-first.
    expect(panel.map((chip) => chip.slug)).toEqual([
      'term-13',
      'term-14',
      'term-15',
      'term-16',
      'term-17',
      'term-18',
      'term-19',
      'term-20',
    ]);
    // Split, not dropped: the union is still the whole table.
    expect([...toolbar, ...panel]).toHaveLength(21);
  });

  it('leaves the panel empty while the whole table fits the row', () => {
    const { toolbar, panel } = splitCategoryChips(chips([5, 4, 3]));
    expect(toolbar).toHaveLength(4);
    expect(panel).toEqual([]);
  });

  it('honours a caller cap (the boundary is exclusive)', () => {
    const { toolbar, panel } = splitCategoryChips(chips([5, 4, 3]), 2);
    expect(toolbar.map((chip) => chip.slug)).toEqual(['', 'term-1', 'term-2']);
    expect(panel.map((chip) => chip.slug)).toEqual(['term-3']);
  });

  it('breaks count ties with the backend order (stable sort)', () => {
    const { toolbar } = splitCategoryChips(chips([2, 2, 2]));
    expect(toolbar.map((chip) => chip.slug)).toEqual(['', 'term-1', 'term-2', 'term-3']);
  });

  it('ranks count-less chips last', () => {
    const { toolbar } = splitCategoryChips([
      ALL,
      { slug: 'quiet', name: '无计数' },
      { slug: 'loud', name: '有计数', count: 7 },
    ]);
    expect(toolbar.map((chip) => chip.slug)).toEqual(['', 'loud', 'quiet']);
  });

  it('never reorders the caller array (rendering reads it twice)', () => {
    const input = chips([1, 9, 5]);
    const before = input.map((chip) => chip.slug);
    splitCategoryChips(input);
    expect(input.map((chip) => chip.slug)).toEqual(before);
  });
});

describe('nextCategorySelection', () => {
  it('selects one term at a time', () => {
    expect(nextCategorySelection([], 'news')).toEqual(['news']);
    expect(nextCategorySelection(['news'], 'dev')).toEqual(['dev']);
  });

  it('clears the selection on the active term and on "all"', () => {
    expect(nextCategorySelection(['news'], 'news')).toEqual([]);
    expect(nextCategorySelection(['news'], '')).toEqual([]);
  });

  it('normalizes a stray multi-term query back to one choice', () => {
    expect(nextCategorySelection(['news', 'dev'], 'news')).toEqual(['news']);
  });
});
