import prisma from "../src/prisma";
import { processEscalationDeliveries } from "../src/worker/processDeliveries";

describe("delivery processor", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.N8N_ALERT_WEBHOOK_URL = "http://example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("marks failed delivery with attempt metadata", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: async () => "n8n webhook 500",
    }) as any;

    const event = await prisma.operationalEvent.create({
      data: {
        eventName: "alert_escalation_requested",
        environment: "test",
        payload: "{}",
      },
    });

    const delivery = await prisma.escalationDelivery.create({
      data: {
        event: { connect: { id: event.id } },
        dedupeKey: `alert_escalation_requested:${event.id}:info`,
        status: "pending",
      },
    });

    await processEscalationDeliveries();

    const updated = await prisma.escalationDelivery.findUnique({
      where: { id: delivery.id },
    });

    expect(updated?.status).toBe("failed");
    expect(updated?.attemptCount).toBe(1);
    expect(updated?.lastAttemptAt).toBeTruthy();
    expect(updated?.lastError).toBe("n8n webhook 500");
    expect(updated?.sentAt).toBeNull();
  });
});
