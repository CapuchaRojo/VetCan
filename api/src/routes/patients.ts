import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const router = Router();


router.get('/', async (req, res, next) => {
try {
const q = req.query.q as string | undefined;
const where = q ? { OR: [{ phone: { contains: q } }, { email: { contains: q } }, { firstName: { contains: q } }, { lastName: { contains: q } }] } : {};
const patients = await prisma.patient.findMany({ where, take: 50 });
res.json(patients);
} catch (err) { next(err); }
});


router.post('/', async (req, res, next) => {
try {
const body = req.body;
const p = await prisma.patient.upsert({
where: { phone: body.phone },
update: body,
create: body
});
res.json(p);
} catch (err) { next(err); }
});


export default router;
