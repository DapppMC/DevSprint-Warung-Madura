import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { hasPrismaCode } from '../lib/prisma-errors';

// Every error ends up here. Known errors become 400 / 404 / 409; anything else is logged on the
// server and answered with a generic 500 so database details never reach the browser.
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Data yang dikirim tidak valid.',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  // express.json() throws a SyntaxError for a malformed request body.
  if (error instanceof SyntaxError) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Format JSON tidak valid.' },
    });
    return;
  }

  if (hasPrismaCode(error, 'P2002')) {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'Data bentrok dengan data yang sudah ada. Silakan coba lagi.',
      },
    });
    return;
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' },
  });
};
