import { describe, expect, it } from 'vitest';
import { homeSectionPagePattern, readHomeSectionRequest } from '@/lib/home-sections';

const at = (search = '') => new URL(`https://example.test/${search}`);

describe('readHomeSectionRequest', () => {
  it('reads the single section/page pair', () => {
    expect(readHomeSectionRequest(at('?section=3&page=2'))).toEqual({ id: 3, page: 2 });
  });

  it('treats a missing page or page 1 as the bare first page', () => {
    expect(readHomeSectionRequest(at('?section=3'))).toEqual({ id: 3, page: 1 });
    expect(readHomeSectionRequest(at('?section=3&page=1'))).toEqual({ id: 3, page: 1 });
  });

  it('ignores a page without a section, or with an invalid section', () => {
    expect(readHomeSectionRequest(at('?page=2'))).toEqual({ id: 0, page: 1 });
    expect(readHomeSectionRequest(at('?section=abc&page=2'))).toEqual({ id: 0, page: 1 });
    expect(readHomeSectionRequest(at('?section=0&page=2'))).toEqual({ id: 0, page: 1 });
  });

  it('rejects multiple section params so only one block can be paged', () => {
    expect(readHomeSectionRequest(at('?section=3&section=5&page=2'))).toEqual({
      id: 0,
      page: 1,
    });
  });

  it('falls back to page 1 for non-integer or non-positive pages', () => {
    expect(readHomeSectionRequest(at('?section=3&page=2.5'))).toEqual({ id: 3, page: 1 });
    expect(readHomeSectionRequest(at('?section=3&page=0'))).toEqual({ id: 3, page: 1 });
  });
});

describe('homeSectionPagePattern', () => {
  it('builds the exclusive section/page URL shape', () => {
    expect(homeSectionPagePattern(3)).toBe('/?section=3&page={page}');
  });
});
