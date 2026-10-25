export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly skip: number;
}

export interface PagedResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
}

export function createPageRequest(page = 1, pageSize = DEFAULT_PAGE_SIZE): PageRequest {
  const safePage = Number.isFinite(page) ? Math.max(Math.trunc(page), 1) : 1;
  const safeSize = Number.isFinite(pageSize)
    ? Math.min(Math.max(Math.trunc(pageSize), 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  return { page: safePage, pageSize: safeSize, skip: (safePage - 1) * safeSize };
}

export function toPagedResult<T>(
  items: readonly T[],
  request: PageRequest,
  totalCount: number,
): PagedResult<T> {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / request.pageSize);
  return {
    items,
    page: request.page,
    pageSize: request.pageSize,
    totalCount,
    totalPages,
    hasNextPage: request.page < totalPages,
  };
}
