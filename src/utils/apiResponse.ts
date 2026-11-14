import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; message?: string; meta?: PaginationMeta } = {},
): Response {
  const { status = 200, message, meta } = options;
  const body: Record<string, unknown> = { success: true, data };
  if (message) body.message = message;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}
