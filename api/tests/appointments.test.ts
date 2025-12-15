import request from 'supertest';
import { createTestApp } from './helpers/app';
import { getTestToken } from './helpers/auth';
import prisma from '../src/prisma';

let app: any;
let server: any;
let token: string;

/**
 * Helper: create a real Patient that matches schema.prisma
 * Phones must be unique
 */
async function createPatient(
  firstName: string,
  lastName: string,
  phone: string
) {
  return prisma.patient.create({
    data: {
      firstName,
      lastName,
      phone,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@test.com`,
    },
  });
}

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
  // Order matters: children → parents
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
});

describe('Appointments API – Conflict Logic', () => {
  it('creates a valid appointment', async () => {
    const patient = await createPatient('John', 'Doe', '555-0001');

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: patient.id,
        doctorId: 'doc-1',
        startTime: '2025-12-14T10:00:00.000Z',
        endTime: '2025-12-14T10:30:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.doctorId).toBe('doc-1');
    expect(res.body.status).toBe('SCHEDULED');
  });

  it('rejects overlapping appointments for the same doctor', async () => {
    const p1 = await createPatient('John', 'Doe', '555-0002');
    const p2 = await createPatient('Jane', 'Smith', '555-0003');

    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: p1.id,
        doctorId: 'doc-2',
        startTime: '2025-12-14T11:00:00.000Z',
        endTime: '2025-12-14T11:30:00.000Z',
      });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: p2.id,
        doctorId: 'doc-2',
        startTime: '2025-12-14T11:15:00.000Z',
        endTime: '2025-12-14T11:45:00.000Z',
      });

    expect(res.status).toBe(409);
  });

  it('allows the same time slot for different doctors', async () => {
    const p1 = await createPatient('Alex', 'Brown', '555-0004');
    const p2 = await createPatient('Chris', 'Green', '555-0005');

    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: p1.id,
        doctorId: 'doc-3',
        startTime: '2025-12-14T12:00:00.000Z',
        endTime: '2025-12-14T12:30:00.000Z',
      });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: p2.id,
        doctorId: 'doc-4',
        startTime: '2025-12-14T12:00:00.000Z',
        endTime: '2025-12-14T12:30:00.000Z',
      });

    expect(res.status).toBe(201);
  });
});

describe('Appointment Cancellation', () => {
  it('cancels a scheduled appointment', async () => {
    const patient = await createPatient('Mark', 'Taylor', '555-0100');

    const create = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: patient.id,
        doctorId: 'doc-9',
        startTime: '2025-12-15T09:00:00.000Z',
        endTime: '2025-12-15T09:30:00.000Z',
      });

    const cancel = await request(app)
      .post(`/api/appointments/${create.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELLED');
  });

  it('prevents double cancellation', async () => {
    const patient = await createPatient('Jane', 'Smith', '555-0101');

    const create = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: patient.id,
        doctorId: 'doc-10',
        startTime: '2025-12-16T10:00:00.000Z',
        endTime: '2025-12-16T10:30:00.000Z',
      });

    await request(app)
      .post(`/api/appointments/${create.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    const second = await request(app)
      .post(`/api/appointments/${create.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(second.status).toBe(409);
  });

  it('cancelled appointments do not block time slots', async () => {
    const p1 = await createPatient('Alex', 'Brown', '555-0102');
    const p2 = await createPatient('Chris', 'Green', '555-0103');

    const first = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: p1.id,
        doctorId: 'doc-11',
        startTime: '2025-12-17T11:00:00.000Z',
        endTime: '2025-12-17T11:30:00.000Z',
      });

    await request(app)
      .post(`/api/appointments/${first.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    const second = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: p2.id,
        doctorId: 'doc-11',
        startTime: '2025-12-17T11:00:00.000Z',
        endTime: '2025-12-17T11:30:00.000Z',
      });

    expect(second.status).toBe(201);
  });
});
