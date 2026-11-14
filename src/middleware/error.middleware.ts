import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { isProduction } from '../config/env';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      code: 'ROUTE_NOT_FOUND',
    },
  });
}

interface MongoDuplicateKeyError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
      },
    });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: { message: `Invalid id format for ${error.path}`, code: 'INVALID_ID' },
    });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((err) => ({
      path: err.path,
      message: err.message,
    }));
    res.status(422).json({
      success: false,
      error: { message: 'Database validation failed', code: 'VALIDATION_ERROR', details },
    });
    return;
  }

  const duplicate = error as MongoDuplicateKeyError;
  if (duplicate?.code === 11000) {
    const field = Object.keys(duplicate.keyValue ?? {})[0] ?? 'field';
    res.status(409).json({
      success: false,
      error: {
        message: `A record with this ${field} already exists`,
        code: 'DUPLICATE_KEY',
        details: [{ path: field, message: `This ${field} is already in use` }],
      },
    });
    return;
  }

  // Unexpected errors: log server-side, never leak internals to the client.

  console.error('[error] unhandled:', error);
  res.status(500).json({
    success: false,
    error: {
      message: isProduction
        ? 'Something went wrong. Please try again later.'
        : String((error as Error)?.message ?? error),
      code: 'INTERNAL_ERROR',
    },
  });
}
