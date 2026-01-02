import { Worker } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = new IORedis(redisUrl);

const callWorker = new Worker(
  "outbound-calls",
  async (job) => {
    console.log("Processing outbound call job", job.id, job.data);
  },
  { connection }
);

const emailWorker = new Worker(
  "email-send",
  async (job) => {
    console.log("Processing email job", job.id, job.data);
  },
  { connection }
);

console.log("Worker started");
