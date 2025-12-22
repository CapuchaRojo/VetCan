// api/src/app.ts
import express from 'express';
import patientsRouter from './routes/patients';
import appointmentsRouter from './routes/appointments';
import callsRouter from './routes/calls';

const app = express();

app.use(express.json());

app.use('/api/patients', patientsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/calls', callsRouter);

export default app;
