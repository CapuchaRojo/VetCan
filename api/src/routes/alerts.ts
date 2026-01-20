import { Router } from "express";
import prisma from "../prisma";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const {
      severity,
      alertType,
      eventName,
      environment,
      ageSeconds,
      callSid,
      summary,
      triggeredAt,
    } = req.body;

    if (!severity || !summary) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const alert = await prisma.alert.create({
      data: {
        severity,
        alertType,
        eventName,
        environment,
        ageSeconds,
        callSid,
        summary,
        triggeredAt: triggeredAt ? new Date(triggeredAt) : new Date(),
      },
    });

    res.status(201).json({ ok: true, alert });
  } catch (err) {
    console.error("[alerts POST]", err);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

export default router;
