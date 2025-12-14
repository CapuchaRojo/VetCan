import request from 'supertest';
import { createTestApp } from './helpers/app';
import { getTestToken } from './helpers/auth';
import prisma from '../src/prisma';

let app: any;
let token: string;

/**
 * Helper: create a real Patient that matches schema.prisma
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
      email: `${firstName.toLowerCase()}@test.com`,
    },
  });
}

describe('Appointments API – Conflict Logic', () => {
  beforeAll(async () => {
    app = await createTestApp();
    token = await getTestToken();
  });

  beforeEach(async () => {
    await prisma.appointment.deleteMany();
    await prisma.patient.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a valid appointment', async () => {
    const p1 = await createPatient('John', 'Doe', '555-0001');

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: p1.id,
        doctorId: 'doc-1',
        startTime: '2025-12-14T10:00:00.000Z',
        endTime: '2025-12-14T10:30:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.doctorId).toBe('doc-1');
  });

  it('rejects overlapping appointments for the same doctor', async () => {
    const p1 = await createPatient('John', 'Doe', '555-0001');
    const p2 = await createPatient('Jane', 'Smith', '555-0002');

    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: p1.id,
        doctorId: 'doc-1',
        startTime: '2025-12-14T10:00:00.000Z',
        endTime: '2025-12-14T10:30:00.000Z',
      });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: p2.id,
        doctorId: 'doc-1',
        startTime: '2025-12-14T10:15:00.000Z',
        endTime: '2025-12-14T10:45:00.000Z',
      });

    expect(res.status).toBe(409);
  });

  it('allows the same time slot for different doctors', async () => {
    const p1 = await createPatient('John', 'Doe', '555-0001');
    const p2 = await createPatient('Alex', 'Brown', '555-0003');

    await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: p1.id,
        doctorId: 'doc-1',
        startTime: '2025-12-14T10:00:00.000Z',
        endTime: '2025-12-14T10:30:00.000Z',
      });

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: p2.id,
        doctorId: 'doc-2',
        startTime: '2025-12-14T10:00:00.000Z',
        endTime: '2025-12-14T10:30:00.000Z',
      });

    expect(res.status).toBe(201);
  });
});

