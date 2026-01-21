import { emitEvent } from "../src/lib/events";
import prisma from "../src/prisma";

async function waitFor<T>(fn: () => Promise<T>, predicate: (value: T) => boolean) {
  const start = Date.now();
  while (Date.now() - start < 1000) {
    const value = await fn();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for persistence");
}

describe("operational event persistence", () => {
  it("persists emitted events to OperationalEvent", async () => {
    emitEvent("callback_requested", {
      source: "sms",
      staffFollowupRequired: true,
      correlationId: "corr-1",
      environment: "test",
    });

    const events = await waitFor(
      () => prisma.operationalEvent.findMany({ where: { eventName: "callback_requested" } }),
      (rows) => rows.length === 1
    );

    expect(events[0]?.eventName).toBe("callback_requested");
  });

  it("creates escalation delivery for alert escalation events with dedupe", async () => {
    const triggeredAt = new Date().toISOString();

    emitEvent("alert_escalation_requested", {
      alertType: "callback_staff_required",
      eventName: "callback_requested",
      summary: "Callback requires staff follow-up",
      environment: "test",
      triggeredAt,
      correlationId: "corr-2",
      severity: "warning",
      ageSeconds: 0,
    });

    const deliveries = await waitFor(
      () => prisma.escalationDelivery.findMany(),
      (rows) => rows.length === 1
    );

    expect(deliveries[0]?.dedupeKey).toBe(
      "alert_escalation_requested:corr-2:warning"
    );

    emitEvent("alert_escalation_requested", {
      alertType: "callback_staff_required",
      eventName: "callback_requested",
      summary: "Callback requires staff follow-up",
      environment: "test",
      triggeredAt,
      correlationId: "corr-2",
      severity: "warning",
      ageSeconds: 0,
    });

    const after = await waitFor(
      () => prisma.escalationDelivery.findMany(),
      (rows) => rows.length === 1
    );

    expect(after.length).toBe(1);
  });
});
