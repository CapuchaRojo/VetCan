import request from 'supertest';
import prisma from '../src/prisma';
import { createTestApp } from './helpers/app';
import { getTestToken } from './helpers/auth';

let app: any;
let server: any;
let token: string;

beforeAll(async () => {
  const setup = await createTestApp();
  app = setup.app;
  server = setup.server;
  token = await getTestToken();
});

afterAll(async () => {
  await prisma.$disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  // Children → parents
  await prisma.call.deleteMany();
  await prisma.patient.deleteMany();
});

const auth = () => ({
  Authorization: `Bearer ${token}`,
});

describe('Calls API – Basic Integration', () => {
  it('creates a call record linked to a patient', async () => {
    const patient = await prisma.patient.create({
      data: {
        firstName: 'Call',
        lastName: 'Patient',
        phone: '+15559990001',
      },
    });

    const res = await request(app)
      .post('/api/calls')
      .set(auth())
      .send({
        patientId: patient.id,
        direction: 'inbound',
        callSid: 'TEST_CALL_SID_001',
        startedAt: new Date().toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.patientId).toBe(patient.id);
    expect(res.body.direction).toBe('inbound');
  });

  it('lists calls', async () => {
    const patient = await prisma.patient.create({
      data: {
        firstName: 'List',
        lastName: 'Patient',
        phone: '+15559990002',
      },
    });

    await prisma.call.create({
      data: {
        patientId: patient.id,
        direction: 'outbound',
        callSid: 'TEST_CALL_SID_002',
        startedAt: new Date(),
      },
    });

    const res = await request(app)
      .get('/api/calls')
      .set(auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/calls');
    expect(res.status).toBe(401);
  });
});
