import express from 'express';
import routes from '../../src/routes';
import http from 'http';

export async function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);

  const server = http.createServer(app);

  return { app, server };
}
