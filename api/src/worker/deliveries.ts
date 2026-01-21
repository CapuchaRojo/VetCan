import { processEscalationDeliveries } from "./processDeliveries";
import { logger } from "../utils/logger";
import prisma from "../prisma";

const pollMs = Number(process.env.ESCALATION_RETRY_POLL_MS || 10_000);

let running = false;
let stopping = false;
let interval: NodeJS.Timeout | null = null;

async function runOnce() {
  if (running || stopping) return;
  running = true;
  try {
    await processEscalationDeliveries();
  } catch (err) {
    logger.error("[deliveries] Processing failed", err);
  } finally {
    running = false;
  }
}

function startLoop() {
  interval = setInterval(runOnce, pollMs);
  void runOnce();
  logger.info(`[deliveries] Worker started (poll ${pollMs}ms)`);
}

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  if (interval) clearInterval(interval);
  logger.info(`[deliveries] Shutdown requested (${signal})`);

  const start = Date.now();
  while (running && Date.now() - start < 5_000) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await prisma.$disconnect().catch((err) => {
    logger.warn("[deliveries] Prisma disconnect failed", err);
  });

  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

startLoop();
