// api/src/routes/callbacks.ts
import { Router } from 'express';
import { notificationProvider } from '../services/notifications';
import prisma from '../prisma';

const router = Router();

/**
 * Phase 1 (Non-PHI) Callback Requests
 *
 * Allowed data:
 * - name (required)
 * - phone (required)
 * - preferredTime (optional)
 * - requestType (optional, non-medical)
 *
 * Disallowed:
 * - symptoms
 * - diagnoses
 * - medications
 * - medical history
 */

const ALLOWED_REQUEST_TYPES = [
  'new_patient',
  'renewal',
  'general_question',
  'scheduling'
] as const;

type RequestType = typeof ALLOWED_REQUEST_TYPES[number];

/**
 * POST /api/callbacks
 * Create a new callback request (NON-PHI)
 */
router.post('/', async (req, res) => {
  try {
    const { name, phone, preferredTime, requestType } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        error: 'name and phone are required'
      });
    }

    let normalizedRequestType: RequestType | null = null;

    if (requestType) {
      if (!ALLOWED_REQUEST_TYPES.includes(requestType)) {
        return res.status(400).json({
          error: `requestType must be one of: ${ALLOWED_REQUEST_TYPES.join(', ')}`
        });
      }
      normalizedRequestType = requestType;
    }

    const callback = await prisma.callbackRequest.create({
      data: {
        name: String(name).trim(),
        phone: String(phone).trim(),
        preferredTime: preferredTime ? String(preferredTime).trim() : null,
        requestType: normalizedRequestType,
        status: 'pending'
      }
    });

    await notificationProvider.send(
      callback.phone,
      `Thanks ${callback.name}, we received your request and will contact you shortly.`
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
 * Mark callback as completed (idempotent + guarded)
 */
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;

    // 🔒 GUARD 1: must exist
    const callback = await prisma.callbackRequest.findUnique({
      where: { id },
    });

    if (!callback) {
      return res.status(404).json({ error: 'Callback not found' });
    }

    // 🔒 GUARD 2: must not already be completed
    if (callback.status === 'completed') {
      return res.status(409).json({
        error: 'Callback already completed',
      });
    }

    // ✅ SAFE UPDATE
    const updated = await prisma.callbackRequest.update({
      where: { id },
      data: { status: 'completed' },
    });

    await notificationProvider.send(
      updated.phone,
      'Thanks for speaking with us! If you need anything else, feel free to reach out.'
    );

    res.json({
      id: updated.id,
      status: updated.status,
      message: 'Callback marked as completed',
    });
  } catch (err) {
    console.error('[callbacks COMPLETE] error:', err);
    res.status(500).json({ error: 'Failed to complete callback' });
  }
});

export default router;
