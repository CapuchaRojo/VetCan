import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

router.post("/dev-token", (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Auth misconfigured" });
  }

  const token = jwt.sign(
    { sub: "dev-operator", role: "admin", name: "Dev Operator" },
    secret,
    { expiresIn: "1h" }
  );

  return res.status(200).json({ token });
});

export default router;
