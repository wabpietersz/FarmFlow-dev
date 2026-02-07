import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';
import { config } from '../config';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  logger.error('Unhandled error', {
    error: err.message,
    code,
    statusCode,
    stack: config.isDevelopment ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    error: config.isProduction && statusCode === 500 ? 'Internal server error' : err.message,
    code,
    statusCode,
    timestamp: new Date().toISOString(),
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: 'Resource not found',
    code: 'NOT_FOUND',
    statusCode: 404,
    timestamp: new Date().toISOString(),
  });
}
