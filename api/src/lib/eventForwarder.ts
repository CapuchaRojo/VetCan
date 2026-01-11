import http from "node:http";
import https from "node:https";
import { onEvent, type EventName } from "./events";

let initialized = false;

const EVENT_NAMES: EventName[] = [
  "voice_state_transition",
  "validation_failed",
  "callback_create_attempt",
  "callback_create_result",
  "ai_call_initiated",
  "appointment_create_result",
];

export function initEventForwarder() {
  if (initialized) return;
  initialized = true;

  const webhookUrl = process.env.EVENT_WEBHOOK_URL;
  if (!webhookUrl) return;

  let target: URL;
  try {
    target = new URL(webhookUrl);
  } catch {
    console.warn("[events] Invalid EVENT_WEBHOOK_URL; forwarding disabled.");
    return;
  }

  const isHttps = target.protocol === "https:";
  const httpClient = isHttps ? https : http;
  const port = target.port
    ? Number(target.port)
    : isHttps
      ? 443
      : 80;
  const path = `${target.pathname}${target.search}`;

  const postEvent = (eventName: EventName, payload: unknown) => {
    const correlationId =
      typeof payload === "object" &&
      payload !== null &&
      "correlationId" in payload
        ? (payload as { correlationId?: string }).correlationId
        : undefined;

    const body = JSON.stringify({
      eventName,
      eventVersion: 1,
      payload,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "local",
      correlationId,
    });

    const req = httpClient.request(
      {
        method: "POST",
        hostname: target.hostname,
        port,
        path,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
      }
    );

    req.on("error", () => {
      console.warn("[events] Failed to forward event.");
    });

    req.write(body);
    req.end();
  };

  for (const eventName of EVENT_NAMES) {
    onEvent(eventName, (payload) => postEvent(eventName, payload));
  }
}
