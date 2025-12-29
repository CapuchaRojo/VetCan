// api/src/routes/callbacks.ts
import { Router } from 'express';
import { notificationProvider } from '../services/notifications';
import prisma from '../prisma';

const router = Router();

/**
 * POST /api/callbacks
 * Create a new callback request
 */
router.post('/', async (req, res) => {
  try {
    const { name, phone, reason } = req.body;

    if (!name || !phone || !reason) {
      return res.status(400).json({
        error: 'name, phone, and reason are required'
      });
    }

    const callback = await prisma.callbackRequest.create({
      data: {
        name,
        phone,
        reason,
        status: 'pending'
      }
    });

    await notificationProvider.send(
      phone,
      `Thanks ${name}, we received your callback request and will contact you shortly.`
    );

    return res.status(201).json({
      id: callback.id,
      status: callback.status,
      message: 'Callback request received'
    });
  } catch (err) {
    console.error('[callbacks POST] error:', err);
    return res.status(500).json({ error: 'Callback creation failed' });
  }
});

/**
 * GET /api/callbacks
 * List all callback requests
 */
router.get('/', async (_req, res) => {
  const callbacks = await prisma.callbackRequest.findMany({
    orderBy: { createdAt: 'desc' }
  });

  res.json(callbacks);
});

/**
 * POST /api/callbacks/:id/complete
 * Mark callback as completed
 */
router.post('/:id/complete', async (req, res) => {
  const { id } = req.params;

  const callback = await prisma.callbackRequest.update({
    where: { id },
    data: { status: 'completed' }
  });

  await notificationProvider.send(
    callback.phone,
    `Thanks for speaking with us! If you need anything else, just reply anytime.`
  );

  res.json({
    id: callback.id,
    status: callback.status,
    message: 'Callback marked as completed'
  });
});

export default router;
