"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.outboundCallQueue = void 0;
var bullmq_1 = require("bullmq");
var ioredis_1 = require("ioredis");
var redisUrl = (_a = process.env.REDIS_URL) !== null && _a !== void 0 ? _a : "redis://localhost:6379";
var connection = new ioredis_1.default(redisUrl);
exports.outboundCallQueue = new bullmq_1.Queue("outbound-calls", {
    connection: connection
});
