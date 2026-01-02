import app from './app';

const PORT = process.env.PORT || 4000;

// 🔒 Authoritative health check (guaranteed runtime)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'vetcan-api',
    source: 'server.ts',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
