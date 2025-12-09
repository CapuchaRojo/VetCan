import { Router } from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';


const router = Router();


// List
router.get('/', requireAuth, async (req, res, next) => {
try {
const appts = await prisma.appointment.findMany({ take: 200, orderBy: { datetime: 'desc' } });
res.json(appts);
} catch (err) { next(err); }
});


// Create (checks for conflicting appt for provider)
router.post('/', requireAuth, async (req, res, next) => {
try {
const { patientId, providerId, datetime } = req.body;
const dt = new Date(datetime);
// basic conflict check +/-30min
const conflict = await prisma.appointment.findFirst({
where: {
providerId,
AND: [
{ datetime: { gte: new Date(dt.getTime() - 30 * 60 * 1000) } },
{ datetime: { lte: new Date(dt.getTime() + 30 * 60 * 1000) } }
]
}
});
if (conflict) return res.status(409).json({ error: 'Provider not available' });


const appt = await prisma.appointment.create({ data: { patientId, providerId, datetime: dt } });
res.json(appt);
} catch (err) { next(err); }
});


// Read
router.get('/:id', requireAuth, async (req, res, next) => {
try {
const a = await prisma.a
