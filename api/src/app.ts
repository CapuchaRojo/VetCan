// api/src/app.ts
import express from 'express';
import patientsRouter from './routes/patients';
import appointmentsRouter from './routes/appointments';
import callsRouter from './routes/calls';
import callbacksRouter from './routes/callbacks';

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ✅ HEALTH CHECK — THIS MUST BE HERE
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'vetcan-api',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/patients', patientsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/callbacks', callbacksRouter);

export default app;
