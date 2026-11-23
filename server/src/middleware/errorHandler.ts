import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Operational AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      errorCode: err.errorCode,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Zod Validation Errors
  if (err instanceof ZodError) {
    const formatted = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      status: 'error',
      errorCode: 'VALIDATION_ERROR',
      message: 'Input validation failed',
      errors: formatted,
    });
    return;
  }

  // Prisma Database Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation (e.g. duplicate email, regNo, [studentId, date])
    if (err.code === 'P2002') {
      const targetFields = (err.meta?.target as string[]) || [];
      const fieldList = targetFields.join(', ');
      res.status(409).json({
        status: 'error',
        errorCode: 'DUPLICATE_ENTRY',
        message: `Conflict: An entry with the specified ${fieldList || 'attribute'} already exists.`,
      });
      return;
    }

    // Record not found
    if (err.code === 'P2025') {
      res.status(404).json({
        status: 'error',
        errorCode: 'RECORD_NOT_FOUND',
        message: 'The requested database record does not exist or has been deleted.',
      });
      return;
    }
  }

  // Unhandled / Internal Server Error
  console.error('[UNHANDLED SERVER ERROR]:', err);

  res.status(500).json({
    status: 'error',
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal error occurred on the server.',
    ...(env.NODE_ENV !== 'production' ? { stack: err.stack, rawMessage: err.message } : {}),
  });
}
