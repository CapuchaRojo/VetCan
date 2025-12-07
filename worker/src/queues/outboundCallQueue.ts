import Queue from "bull";

export const outboundCallQueue = new Queue("outbound-calls", process.env.REDIS_URL);

outboundCallQueue.process(async (job) => {
  console.log("Processing outbound call:", job.data);
});
