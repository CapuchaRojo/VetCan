import request from 'supertest';
import prisma from '../src/prisma';
import { createTestApp } from './helpers/app';
import { getTestToken } from './helpers/auth';

const app = createTestApp();

const auth = () => ({
  Authorization: `Bearer ${getTestToken()}`
});

describe('Patients API – Full CRUD', () => {
  beforeEach(async () => {
    // Delete children first
    await prisma.appointment.deleteMany();
    await prisma.call.deleteMany();

    // Then delete parents
    await prisma.patient.deleteMany();
  });


  it('POST /api/patients → creates a patient', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set(auth())
      .send({
        firstName: 'John',
        lastName: 'Doe',
        phone: '+15551234567',
        email: 'john@vetcan.test',
        isVeteran: true
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.phone).toBe('+15551234567');

    const dbPatient = await prisma.patient.findUnique({
      where: { phone: '+15551234567' }
    });

    expect(dbPatient).not.toBeNull();
    expect(dbPatient?.isVeteran).toBe(true);
  });

  it('GET /api/patients → lists patients', async () => {
    await prisma.patient.create({
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+15550000001'
      }
    });

    const res = await request(app)
      .get('/api/patients')
      .set(auth());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/patients/:id → fetches a single patient', async () => {
    const patient = await prisma.patient.create({
      data: {
        firstName: 'Mike',
        lastName: 'Ross',
        phone: '+15550000002'
      }
    });

    const res = await request(app)
      .get(`/api/patients/${patient.id}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(patient.id);
    expect(res.body.firstName).toBe('Mike');
  });

  it('PUT /api/patients/:id → updates patient data', async () => {
    const patient = await prisma.patient.create({
      data: {
        firstName: 'Old',
        lastName: 'Name',
        phone: '+15550000003'
      }
    });

    const res = await request(app)
      .put(`/api/patients/${patient.id}`)
      .set(auth())
      .send({
        firstName: 'Updated'
      });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Updated');

    const dbPatient = await prisma.patient.findUnique({
      where: { id: patient.id }
    });

    expect(dbPatient?.firstName).toBe('Updated');
  });

  it('DELETE /api/patients/:id → deletes patient', async () => {
    const patient = await prisma.patient.create({
      data: {
        firstName: 'Temp',
        lastName: 'Delete',
        phone: '+15550000004'
      }
    });

    const res = await request(app)
      .delete(`/api/patients/${patient.id}`)
      .set(auth());

    expect(res.status).toBe(200);

    const dbPatient = await prisma.patient.findUnique({
      where: { id: patient.id }
    });

    expect(dbPatient).toBeNull();
  });

  it('Rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });
});

