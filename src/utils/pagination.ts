import { ApiError } from './ApiError';
import { PaginationMeta } from './apiResponse';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export function parsePagination(rawPage: unknown, rawLimit: unknown): PaginationParams {
  const page = Number.parseInt(String(rawPage ?? ''), 10);
  const limit = Number.parseInt(String(rawLimit ?? ''), 10);

  if (!Number.isNaN(page) && page <= 0) {
    throw ApiError.badRequest('page must be a positive integer');
  }
  if (!Number.isNaN(limit) && limit <= 0) {
    throw ApiError.badRequest('limit must be a positive integer');
  }

  const safePage = Number.isNaN(page) || page <= 0 ? DEFAULT_PAGE : page;
  const safeLimit = Number.isNaN(limit) || limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);

  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
