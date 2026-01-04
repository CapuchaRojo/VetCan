// api/src/app.ts
import express from 'express';
import routes from './routes';
import { apiLimiter } from "./middleware/rateLimit";

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/api", apiLimiter);

// ✅ Single authoritative health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'vetcan-api',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ✅ Mount ALL routes through the barrel
app.use('/api', routes);

// 🔎 DEBUG: list registered routes
app.get('/__debug/routes', (_req, res) => {
  // @ts-ignore
  const stack = app._router.stack
    .filter((r: any) => r.route)
    .map((r: any) => ({
      path: r.route.path,
      methods: r.route.methods,
    }));

  res.json(stack);
});

export default app;
