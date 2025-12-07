import { Worker } from 'bullmq';
import IORedis from 'ioredis';


const connection = new IORedis(process.env.REDIS_URL);


const callWorker = new Worker('outbound-calls', async job => {
console.log('Processing outbound call job', job.id, job.data);
// call Twilio adapter via API or SDK
}, { connection });


const emailWorker = new Worker('email-send', async job => {
console.log('Processing email job', job.id, job.data);
}, { connection });


console.log('Worker started');
