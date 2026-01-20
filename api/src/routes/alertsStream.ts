import { Router } from "express";
import { addAlertStreamClient, removeAlertStreamClient } from "../lib/alertStream";

const router = Router();

router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders();

  addAlertStreamClient(res);

  req.on("close", () => {
    removeAlertStreamClient(res);
  });
});

export default router;
