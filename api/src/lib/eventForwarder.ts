import http from "node:http";
import https from "node:https";
import { onEvent, type EventName } from "./events";

let initialized = false;
let forwarderEnabled = false;
let n8nWarned = false;

const EVENT_NAMES: EventName[] = [
  "voice_state_transition",
  "voice_call_started",
  "voice_intent_detected",
  "voice_call_completed",
  "validation_failed",
  "callback_create_attempt",
  "callback_create_result",
  "callback_create_failed",
  "ai_call_initiated",
  "appointment_create_result",
  "alert_triggered",
  "alert_escalation_requested",
  "alert_resolved",
  "alert_acknowledged",
  "callback_marked_staff_handled",
  "callback_requested",
];

export function initEventForwarder() {
  if (initialized) return;
  initialized = true;

  const webhookUrl = process.env.EVENT_WEBHOOK_URL;
  const n8nWebhookUrl = process.env.N8N_ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    let target: URL | null = null;
    try {
      target = new URL(webhookUrl);
    } catch {
      console.warn("[events] Invalid EVENT_WEBHOOK_URL; forwarding disabled.");
    }

    if (target) {
      forwarderEnabled = true;

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
          (res) => res.resume()
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
  }

  const postN8nEvent = (payload: unknown) => {
    if (!n8nWebhookUrl) {
      if (!n8nWarned) {
        n8nWarned = true;
        console.warn("[events] N8N_ALERT_WEBHOOK_URL not set; n8n forwarding disabled.");
      }
      return;
    }

    let target: URL;
    try {
      target = new URL(n8nWebhookUrl);
    } catch {
      if (!n8nWarned) {
        n8nWarned = true;
        console.warn("[events] Invalid N8N_ALERT_WEBHOOK_URL; forwarding disabled.");
      }
      return;
    }

    const isHttpsTarget = target.protocol === "https:";
    const client = isHttpsTarget ? https : http;
    const port = target.port
      ? Number(target.port)
      : isHttpsTarget
        ? 443
        : 80;
    const path = `${target.pathname}${target.search}`;
    const body = JSON.stringify(payload);

    const req = client.request(
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
      (res) => res.resume()
    );

    req.on("error", () => {
      console.warn("[events] Failed to forward n8n escalation.");
    });

    req.write(body);
    req.end();
  };

  onEvent("alert_escalation_requested", (payload) => {
    postN8nEvent(payload);
  });
}

export function isEventForwarderEnabled() {
  return forwarderEnabled;
}
