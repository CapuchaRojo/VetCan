import { Router } from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';


const router = Router();


// List / search
router.get('/', requireAuth, async (req, res, next) => {
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
} catch (err) { next(err); }
});


// Create
router.post('/', requireAuth, async (req, res, next) => {
try {
const body = req.body;
const p = await prisma.patient.create({ data: body });
res.json(p);
} catch (err) { next(err); }
});


// Read
router.get('/:id', requireAuth, async (req, res, next) => {
try {
const p = await prisma.patient.findUnique({ where: { id: req.params.id } });
if (!p) return res.status(404).json({ error: 'Not found' });
res.json(p);
} catch (err) { next(err); }
});


// Update
router.put('/:id', requireAuth, async (req, res, next) => {
try {
const data = req.body;
const p = await prisma.patient.update({ where: { id: req.params.id }, data });
res.json(p);
} catch (err) { next(err); }
});


// Delete
router.delete('/:id', requireAuth, async (req, res, next) => {
try {
await prisma.patient.delete({ where: { id: req.params.id } });
res.json({ ok: true });
} catch (err) { next(err); }
});


export default router;
