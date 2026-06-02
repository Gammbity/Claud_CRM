import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      status: err.statusCode,
    });
    return;
  }

  // Prisma unique constraint
  if ((err as { code?: string }).code === 'P2002') {
    res.status(409).json({ error: 'A record with this value already exists.' });
    return;
  }

  // Prisma record not found
  if ((err as { code?: string }).code === 'P2025') {
    res.status(404).json({ error: 'Record not found.' });
    return;
  }

  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
