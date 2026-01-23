process.env.ESCALATION_RETRY_BASE_MS = "0";
process.env.ESCALATION_RETRY_JITTER_MS = "0";
process.env.ESCALATION_BREAKER_FAILURE_THRESHOLD = "2";
process.env.ESCALATION_BREAKER_OPEN_MS = "1000";

import prisma from "../src/prisma";

describe("delivery processor", () => {
  const originalFetch = global.fetch;

  let processEscalationDeliveries: () => Promise<void>;

  beforeEach(async () => {
    jest.resetModules();

    process.env.N8N_ALERT_WEBHOOK_URL = "http://example.com";

    ({ processEscalationDeliveries } = await import(
      "../src/worker/processDeliveries"
    ));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
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

  it("opens breaker after failures and allows half-open probe", async () => {
    // initial time
    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2025-01-01T00:00:00.000Z").getTime()
    );

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      text: async () => "n8n webhook 500",
    });
    global.fetch = fetchMock as any;

    const event = await prisma.operationalEvent.create({
      data: {
        eventName: "alert_escalation_requested",
        environment: "test",
        payload: "{}",
      },
    });

    const deliveryA = await prisma.escalationDelivery.create({
      data: {
        event: { connect: { id: event.id } },
        dedupeKey: `alert_escalation_requested:${event.id}:info`,
        status: "pending",
      },
    });

    // first failure
    await processEscalationDeliveries();

    // second delivery → second failure → breaker opens
    const deliveryB = await prisma.escalationDelivery.create({
      data: {
        event: { connect: { id: event.id } },
        dedupeKey: `alert_escalation_requested:${event.id}:warn`,
        status: "pending",
      },
    });

    (Date.now as jest.Mock).mockReturnValue(
      new Date("2025-01-01T00:00:06.000Z").getTime()
    );

    await processEscalationDeliveries();

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // breaker open → skip
    await processEscalationDeliveries();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // advance past breaker open window
    (Date.now as jest.Mock).mockReturnValue(
      new Date("2025-01-01T00:00:08.000Z").getTime()
    );

    // half-open probe (does NOT deliver old failures)
    fetchMock.mockResolvedValueOnce({ ok: true });
    await processEscalationDeliveries();

    const afterProbe = await prisma.escalationDelivery.findUnique({
      where: { id: deliveryA.id },
    });

    expect(afterProbe?.status).toBe("failed");

    // ✅ ADVANCE TIME so new delivery is eligible
    (Date.now as jest.Mock).mockReturnValue(
      new Date("2025-01-01T00:00:10.000Z").getTime()
    );

    // new delivery after breaker is closed
    const event2 = await prisma.operationalEvent.create({
      data: {
        eventName: "alert_escalation_requested",
        environment: "test",
        payload: "{}",
      },
    });

    const deliveryC = await prisma.escalationDelivery.create({
      data: {
        event: { connect: { id: event2.id } },
        dedupeKey: `alert_escalation_requested:${event2.id}:info`,
        status: "pending",
      },
    });

    fetchMock.mockResolvedValueOnce({ ok: true });
    await processEscalationDeliveries();

    const afterSecond = await prisma.escalationDelivery.findUnique({
      where: { id: deliveryC.id },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(afterSecond?.status).toBe("delivered");
    expect(afterSecond?.attemptCount).toBe(1);
  });
});
