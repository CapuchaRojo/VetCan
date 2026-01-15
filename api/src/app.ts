import express from 'express';
import routes from './routes';
import { apiLimiter } from './middleware/rateLimit';
import { requestLogger } from './middleware/requestLogger';
import {
  notFoundHandler,
  errorHandler,
} from './middleware/errorHandler';

const app = express();

app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));

// 🔒 Rate limit + log ONLY API traffic
app.use('/api', apiLimiter);
app.use('/api', requestLogger);

// ✅ Health check (no logging, no rate limit noise)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'vetcan-api',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 🚦 API ROUTES
app.use('/api', routes);

// ❌ 404 handler (after routes)
app.use(notFoundHandler);

// 💥 Global error handler (last, always)
app.use(errorHandler);

export default app;
