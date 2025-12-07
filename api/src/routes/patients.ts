import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  return res.json({ message: "Patients endpoint OK" });
});

export default router;
