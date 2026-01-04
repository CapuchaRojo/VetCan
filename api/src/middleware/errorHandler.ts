import { Request, Response, NextFunction } from 'express';

export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
) {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.statusCode || err.status || 500;

  // 🔒 Log once, centrally
  console.error('[API ERROR]', {
    method: req.method,
    path: req.originalUrl,
    status,
    message: err.message,
  });

  res.status(status).json({
    error: status === 500
      ? 'Internal server error'
      : err.message || 'Request failed',
  });
}
