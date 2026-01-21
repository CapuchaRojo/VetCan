import express from 'express';
import routes from './routes';
import alertsRouter from './routes/alerts';
import { apiLimiter } from './middleware/rateLimit';
import alertsStreamRouter from "./routes/alertsStream";
import { requestLogger } from './middleware/requestLogger';
import { logger } from './utils/logger';
import {
  notFoundHandler,
  errorHandler,
} from './middleware/errorHandler';

const app = express();

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

// ✅ INTERNAL: alert ingestion (NO rate limiting, NO logging)
app.use('/api/alerts', alertsRouter);

// 🔒 PUBLIC API: rate limited + logged
app.use('/api', (req, res, next) => {
  if (req.path === '/callbacks') return next();
  return apiLimiter(req, res, next);
});

app.use('/api', requestLogger);

// 🚦 API ROUTES
app.use('/api', routes);

// ✅ Health check (no logging, no rate limit noise)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'vetcan-api',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/alerts", alertsRouter);

app.use("/api/alerts", alertsStreamRouter);

// ❌ 404 handler (after routes)
app.use(notFoundHandler);

// 💥 Global error handler (last, always)
app.use(errorHandler);

process.on('unhandledRejection', (reason) => {
  logger.error('[FATAL] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('[FATAL] Uncaught exception:', err);
});

export default app;
