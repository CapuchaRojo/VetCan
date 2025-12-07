import { Router } from "express";
import patients from "./patients";
import appointments from "./appointments";
import calls from "./calls";
import auth from "./auth";

export const router = Router();

router.use("/auth", auth);
router.use("/patients", patients);
router.use("/appointments", appointments);
router.use("/calls", calls);
