import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = new IORedis(redisUrl);

export const outboundCallQueue = new Queue("outbound-calls", {
  connection
});
