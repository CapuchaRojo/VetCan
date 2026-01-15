import { Router } from 'express';
import prisma from '../prisma';
import requireAuth from '../middleware/auth';
import {
  createPatientSchema,
  updatePatientSchema,
} from '../validators/patient';
import type { ZodIssue } from "zod";

const router = Router();

/**
 * Protect all patient routes
 */
router.use(requireAuth);

// List / search
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q as string) || '';
    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { phone: { contains: q } },
          { email: { contains: q } },
          { firstName: { contains: q } },
          { lastName: { contains: q } }
        ]
      },
      take: 100,
      orderBy: { createdAt: 'desc' }
    });
    res.json(patients);
  } catch (err) {
    next(err);
  }
});

// Create
router.post('/', async (req, res, next) => {
  try {
    const parsed = createPatientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        issues: parsed.error.issues.map((issue: ZodIssue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    const p = await prisma.patient.create({ data: parsed.data });
    res.json(p);
  } catch (err) {
    next(err);
  }
});

// Read
router.get('/:id', async (req, res, next) => {
  try {
    const p = await prisma.patient.findUnique({
      where: { id: req.params.id }
    });
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) {
    next(err);
  }
});

// Update
router.put('/:id', async (req, res, next) => {
  try {
    const parsed = updatePatientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        issues: parsed.error.issues.map((issue: ZodIssue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    const p = await prisma.patient.update({
      where: { id: req.params.id },
      data: parsed.data
    });
    res.json(p);
  } catch (err) {
    next(err);
  }
});

// Delete
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.patient.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
