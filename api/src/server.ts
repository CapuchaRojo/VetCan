import express from 'express';
import routes from './routes';

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Mount ALL routes
app.use('/api', routes);

// 🔎 HARD DEBUG — PROVE ROUTES EXIST
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
