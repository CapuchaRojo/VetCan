// api/src/routes/index.ts
import { Router } from "express";

import appointmentsRouter from "./appointments";
import patientsRouter from "./patients";
import callsRouter from "./calls";
import callbacksRouter from "./callbacks";
import smsRouter from "./sms";
import stats from "./stats";
import metricsRouter from "./metrics";
import internalMetricsRouter from "./internalMetrics";
import internalEscalationsRouter from "./internalEscalations";
import internalRouter from "./internal";
import voiceRouter from "./voice";
import authRouter from "./auth";

const router = Router();

/* -------------------------------------------------
   CORE API ROUTES
-------------------------------------------------- */

router.use("/appointments", appointmentsRouter);
router.use("/patients", patientsRouter);
router.use("/calls", callsRouter);
router.use("/callbacks", callbacksRouter);
router.use("/webhooks/twilio", smsRouter);
router.use("/stats", stats);
router.use("/metrics", metricsRouter);
router.use("/internal/metrics", internalMetricsRouter);
router.use("/internal/escalations", internalEscalationsRouter);
router.use("/internal", internalRouter);
router.use("/auth", authRouter);

/* -------------------------------------------------
   VOICE ROUTES
-------------------------------------------------- */

router.use("/", voiceRouter);

export default router;
