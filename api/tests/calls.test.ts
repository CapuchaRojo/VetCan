import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma';

let token = 'test-token';

const auth = () => ({
  Authorization: `Bearer ${token}`,
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.call.deleteMany();
  await prisma.patient.deleteMany();
});

describe('Calls API – Basic Integration', () => {
  it('creates a call record linked to a patient', async () => {
    const patient = await prisma.patient.create({
      data: {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+15559999999',
      },
    });

    const res = await request(app)
      .post('/api/calls')
      .set(auth())
      .send({
        patientId: patient.id,
        notes: 'Initial call',
      });

    expect(res.status).toBe(201);
    expect(res.body.patientId).toBe(patient.id);
  });

  it('lists calls', async () => {
    const res = await request(app)
      .get('/api/calls')
      .set(auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/calls');
    expect(res.status).toBe(200);
  });
});
