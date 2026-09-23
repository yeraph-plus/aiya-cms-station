import { describe, expect, it } from 'vitest';
import type { AiyaClient } from '@/lib/core/client';
import type { PostSummary } from '@/lib/core/contracts';
import {
  interleavePages,
  isSearchScope,
  loadSearchPage,
  normalizeKeyword,
  searchHref,
  searchPagePattern,
  searchPath,
  SEARCH_PAGE_SIZE,
} from '@/lib/search';

/** The helpers only ever read `id`; the rest of the contract is irrelevant. */
const summary = (id: number): PostSummary => ({ id }) as unknown as PostSummary;

interface Reply {
  items: PostSummary[];
  totalPages: number;
}

/** Minimal stand-in for the API client: records the reads and answers them. */
function stubClient(reply: (type: string | undefined, page: number) => Reply) {
  const calls: { q: string; type: string | undefined; page: number; perPage: number }[] = [];
  const client = {
    search: async (query: { q: string; type?: string; page?: number; perPage?: number }) => {
      const page = query.page ?? 1;
      calls.push({ q: query.q, type: query.type, page, perPage: query.perPage ?? 0 });
      const { items, totalPages } = reply(query.type, page);
      return {
        data: items,
        meta: {
          pagination: {
            page,
            perPage: query.perPage ?? SEARCH_PAGE_SIZE,
            totalItems: items.length,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
          },
        },
      };
    },
  } as unknown as AiyaClient;
  return { client, calls };
}

describe('search keyword and paths', () => {
  it('normalizes the routed key and caps it at the endpoint limit', () => {
    expect(normalizeKeyword('  wall  ')).toBe('wall');
    expect(normalizeKeyword('   ')).toBe('');
    expect(normalizeKeyword('x'.repeat(140))).toHaveLength(100);
  });

  it('accepts only the four scopes', () => {
    for (const scope of ['all', 'post', 'page', 'resource']) {
      expect(isSearchScope(scope)).toBe(true);
    }
    expect(isSearchScope('discussion')).toBe(false);
    expect(isSearchScope('')).toBe(false);
  });

  it('encodes the keyword into the path and adds the scope as a query', () => {
    expect(searchPath('wall')).toBe('/search/wall/');
    expect(searchPath('中文 词')).toBe('/search/%E4%B8%AD%E6%96%87%20%E8%AF%8D/');
    expect(searchPath('wall', 3)).toBe('/search/wall/page/3/');
    expect(searchPagePattern('wall')).toBe('/search/wall/page/{page}/');
    expect(searchHref('wall', 'all')).toBe('/search/wall/');
    expect(searchHref('wall', 'resource')).toBe('/search/wall/?type=resource');
  });
});

describe('interleavePages', () => {
  it('round-robins one item per type so a page never walls off a type', () => {
    const merged = interleavePages([
      [summary(1), summary(2)],
      [summary(11)],
      [summary(21), summary(22)],
    ]);
    expect(merged.map((item) => item.id)).toEqual([1, 11, 21, 2, 22]);
  });

  it('skips exhausted lists and tolerates empty input', () => {
    expect(interleavePages([[], [summary(1)], []])).toEqual([summary(1)]);
    expect(interleavePages([])).toEqual([]);
  });
});

describe('loadSearchPage', () => {
  it('reads one type when a scope is set and passes its pagination through', async () => {
    const { client, calls } = stubClient(() => ({ items: [summary(1)], totalPages: 4 }));
    const result = await loadSearchPage(client, { key: 'wall', scope: 'post', page: 2 });

    expect(calls).toEqual([{ q: 'wall', type: 'post', page: 2, perPage: SEARCH_PAGE_SIZE }]);
    expect(result.items.map((item) => item.id)).toEqual([1]);
    // A scoped read is the endpoint's own pagination, untouched.
    expect(result.pagination).toMatchObject({
      page: 2,
      perPage: SEARCH_PAGE_SIZE,
      totalPages: 4,
      hasNext: true,
      hasPrevious: true,
    });
  });

  it('unions every public type in the all scope, interleaved', async () => {
    const { client, calls } = stubClient((type) => ({
      items: type === 'page' ? [summary(11), summary(12)] : [summary(type === 'post' ? 1 : 21)],
      totalPages: type === 'resource' ? 3 : 1,
    }));
    const result = await loadSearchPage(client, { key: 'wall', scope: 'all', page: 1 });

    expect(calls.map((entry) => entry.type)).toEqual(['post', 'page', 'resource']);
    expect(calls.every((entry) => entry.page === 1)).toBe(true);
    expect(result.items.map((item) => item.id)).toEqual([1, 11, 21, 12]);
    // The union's reach is the longest of the three types, not their sum.
    expect(result.pagination).toEqual({
      page: 1,
      totalPages: 3,
      hasNext: true,
      hasPrevious: false,
    });
  });

  it('stops the union on the last page of the longest type', async () => {
    const { client } = stubClient(() => ({ items: [], totalPages: 2 }));
    const result = await loadSearchPage(client, { key: 'wall', scope: 'all', page: 2 });
    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual({
      page: 2,
      totalPages: 2,
      hasNext: false,
      hasPrevious: true,
    });
  });

  it('keeps a keyword with no matches at one page', async () => {
    const { client } = stubClient(() => ({ items: [], totalPages: 0 }));
    const result = await loadSearchPage(client, { key: 'zzz', scope: 'all', page: 1 });
    expect(result.items).toEqual([]);
    expect(result.pagination.totalPages).toBe(1);
    expect(result.pagination.hasNext).toBe(false);
  });
});
