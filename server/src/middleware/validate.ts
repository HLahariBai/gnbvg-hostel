import type { Request, Response, NextFunction } from 'express';
import { ZodError, type AnyZodObject } from 'zod';

/**
 * Validates express request payload against a Zod schema.
 * Supports validating body, query, and params.
 */
export function validateRequest(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Replace with parsed/sanitized versions
      req.body = parsed.body ?? req.body;
      req.query = parsed.query ?? req.query;
      req.params = parsed.params ?? req.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join('.').replace(/^(body|query|params)\./, ''),
          message: err.message,
        }));

        res.status(400).json({
          status: 'error',
          errorCode: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          errors: validationErrors,
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Helper to encode / sanitize dangerous HTML characters to prevent stored XSS.
 */
export function sanitizeString(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
