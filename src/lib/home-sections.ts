/**
 * Homepage pagination is deliberately exclusive: the URL carries at most
 * one `section` id plus its `page`, never a page for every section. Page 1
 * is the bare `/`; page N is `?section=<id>&page=<n>`.
 */
export const HOME_SECTION_QUERY = 'section';
export const HOME_PAGE_QUERY = 'page';

export interface HomeSectionRequest {
  /** 0 means "no section selected"; every section then renders page 1. */
  id: number;
  page: number;
}

export function readHomeSectionRequest(url: URL): HomeSectionRequest {
  const sectionValues = url.searchParams.getAll(HOME_SECTION_QUERY);
  if (sectionValues.length !== 1) return { id: 0, page: 1 };

  const id = Number(sectionValues[0]);
  if (!Number.isInteger(id) || id < 1) return { id: 0, page: 1 };

  const pageValue = url.searchParams.get(HOME_PAGE_QUERY);
  const page = pageValue === null ? 1 : Number(pageValue);
  return {
    id,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function homeSectionPagePattern(id: number): string {
  return `/?${HOME_SECTION_QUERY}=${id}&${HOME_PAGE_QUERY}={page}`;
}
