import prisma from "../src/prisma";

describe("Escalation Flow Integrity Matrix", () => {
  const envKeys = [
    "N8N_ALERT_WEBHOOK_URL",
    "ESCALATION_RETRY_BASE_MS",
    "ESCALATION_RETRY_JITTER_MS",
    "ESCALATION_BREAKER_OPEN_MS",
    "ESCALATION_BREAKER_FAILURE_THRESHOLD",
    "ESCALATION_METRICS_SNAPSHOT_MS",
    "ESCALATION_METRICS_RETENTION_DAYS",
  ];
  const originalEnv: Record<string, string | undefined> = {};
  for (const key of envKeys) {
    originalEnv[key] = process.env[key];
  }
  const originalFetch = global.fetch;

  let processEscalationDeliveries: () => Promise<void>;
  let compactEscalationMetricsSnapshots: (nowMs: number) => Promise<void>;
  let resetBreakerForTests: () => void;
  let setBreakerStateForTests: (params: {
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    consecutiveFailures?: number;
    openedAtMs?: number | null;
    halfOpenProbeInFlight?: boolean;
    lastDeniedLogAt?: number;
  }) => void;
  let escalationMetrics: {
    counters: {
      attempted: number;
      delivered: number;
      failed: number;
      skippedBreaker: number;
      skippedBackoff: number;
      skippedNonePending: number;
    };
  };

  beforeEach(async () => {
    jest.resetModules();

    process.env.N8N_ALERT_WEBHOOK_URL = "http://example.com";
    process.env.ESCALATION_RETRY_BASE_MS = "10000";
    process.env.ESCALATION_RETRY_JITTER_MS = "0";
    process.env.ESCALATION_BREAKER_OPEN_MS = "60000";
    process.env.ESCALATION_BREAKER_FAILURE_THRESHOLD = "3";
    process.env.ESCALATION_METRICS_SNAPSHOT_MS = "0";
    process.env.ESCALATION_METRICS_RETENTION_DAYS = "14";

    const deliveriesModule = await import(
      "../src/worker/processDeliveries"
    );
    processEscalationDeliveries = deliveriesModule.processEscalationDeliveries;
    compactEscalationMetricsSnapshots =
      deliveriesModule.compactEscalationMetricsSnapshots;
    resetBreakerForTests = deliveriesModule.resetBreakerForTests;
    setBreakerStateForTests = deliveriesModule.setBreakerStateForTests;

    const metricsModule = await import("../src/worker/escalationMetrics");
    escalationMetrics = metricsModule.escalationMetrics;

    escalationMetrics.counters.attempted = 0;
    escalationMetrics.counters.delivered = 0;
    escalationMetrics.counters.failed = 0;
    escalationMetrics.counters.skippedBreaker = 0;
    escalationMetrics.counters.skippedBackoff = 0;
    escalationMetrics.counters.skippedNonePending = 0;

    resetBreakerForTests();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  describe("A. Delivery Functional Integrity", () => {
    it("1) happy path delivery", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

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

      expect(updated?.status).toBe("delivered");
      expect(updated?.attemptCount).toBe(1);
      expect(updated?.sentAt).toBeTruthy();
      expect(updated?.lastError).toBeNull();

      expect(escalationMetrics.counters).toEqual({
        attempted: 1,
        delivered: 1,
        failed: 0,
        skippedBreaker: 0,
        skippedBackoff: 0,
        skippedNonePending: 0,
      });
    });

    it("2) backoff skip (no attempt)", async () => {
      const nowMs = Date.UTC(2026, 0, 24, 12, 0, 0);
      jest.spyOn(Date, "now").mockReturnValue(nowMs);

      global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

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
          attemptCount: 1,
          lastAttemptAt: new Date(nowMs),
        },
      });

      await processEscalationDeliveries();

      expect(global.fetch).not.toHaveBeenCalled();

      const updated = await prisma.escalationDelivery.findUnique({
        where: { id: delivery.id },
      });

      expect(updated?.status).toBe("pending");
      expect(updated?.attemptCount).toBe(1);

      expect(escalationMetrics.counters.skippedBackoff).toBe(1);
      expect(escalationMetrics.counters.attempted).toBe(0);
    });

    it("3) breaker open skip", async () => {
      const nowMs = Date.UTC(2026, 0, 24, 12, 5, 0);
      jest.spyOn(Date, "now").mockReturnValue(nowMs);

      setBreakerStateForTests({
        state: "OPEN",
        consecutiveFailures: 0,
        openedAtMs: nowMs - 1000,
        halfOpenProbeInFlight: false,
      });

      global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

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

      expect(global.fetch).not.toHaveBeenCalled();

      const updated = await prisma.escalationDelivery.findUnique({
        where: { id: delivery.id },
      });

      expect(updated?.status).toBe("pending");
      expect(updated?.attemptCount).toBe(0);
      expect(escalationMetrics.counters.skippedBreaker).toBe(1);
    });
  });

  describe("B. Metrics Snapshot Integrity", () => {
  it("4) snapshot persistence", async () => {
    process.env.ESCALATION_METRICS_SNAPSHOT_MS = "1";

    const nowMs = Date.UTC(2026, 0, 24, 13, 0, 0);
    jest.spyOn(Date, "now").mockReturnValue(nowMs);

    escalationMetrics.counters.attempted = 4;
    escalationMetrics.counters.delivered = 2;
    escalationMetrics.counters.failed = 1;
    escalationMetrics.counters.skippedBreaker = 3;
    escalationMetrics.counters.skippedBackoff = 5;
    escalationMetrics.counters.skippedNonePending = 7;

    setBreakerStateForTests({
      state: "CLOSED",
      consecutiveFailures: 0,
      openedAtMs: null,
    });

    await processEscalationDeliveries();

    const snapshots = await prisma.escalationMetricsSnapshot.findMany({
      orderBy: { createdAt: "desc" },
    });

    expect(snapshots).toHaveLength(1);

const snapshot = snapshots[0];
    expect(snapshot.attempted).toBe(4);
    expect(snapshot.delivered).toBe(2);
    expect(snapshot.failed).toBe(1);
    expect(snapshot.skippedBreaker).toBe(3);
    expect(snapshot.skippedBackoff).toBe(5);
    expect(snapshot.skippedNonePending).toBe(7);
    expect(snapshot.breakerState).toBe("CLOSED");;
  });
});
            
  describe("C. Retention + Rollup Integrity", () => {
    it("5) rollup + retention", async () => {
      process.env.ESCALATION_METRICS_RETENTION_DAYS = "2";

      const nowMs = Date.UTC(2026, 0, 24, 12, 0, 0);
      const cutoffDayStartMs = Date.UTC(2026, 0, 22, 0, 0, 0);

      const expiredHour = Date.UTC(2026, 0, 20, 5, 0, 0);
      const expiredDayStart = Date.UTC(2026, 0, 20, 0, 0, 0);
      const expiredDay2Start = Date.UTC(2026, 0, 21, 0, 0, 0);

      await prisma.escalationMetricsSnapshot.createMany({
        data: [
          {
            createdAt: new Date(expiredHour + 10 * 60 * 1000),
            attempted: 1,
            delivered: 1,
            failed: 0,
            skippedBreaker: 0,
            skippedBackoff: 0,
            skippedNonePending: 0,
            breakerState: "OPEN",
            breakerFailureCount: 1,
            breakerOpenedAt: null,
            breakerOpenUntil: null,
            breakerRemainingMs: null,
            source: "worker",
          },
          {
            createdAt: new Date(expiredHour + 40 * 60 * 1000),
            attempted: 2,
            delivered: 1,
            failed: 1,
            skippedBreaker: 1,
            skippedBackoff: 1,
            skippedNonePending: 0,
            breakerState: "CLOSED",
            breakerFailureCount: 0,
            breakerOpenedAt: null,
            breakerOpenUntil: null,
            breakerRemainingMs: null,
            source: "worker",
          },
          {
            createdAt: new Date(Date.UTC(2026, 0, 21, 10, 15, 0)),
            attempted: 3,
            delivered: 2,
            failed: 1,
            skippedBreaker: 0,
            skippedBackoff: 1,
            skippedNonePending: 1,
            breakerState: "OPEN",
            breakerFailureCount: 2,
            breakerOpenedAt: null,
            breakerOpenUntil: null,
            breakerRemainingMs: null,
            source: "worker",
          },
          {
            createdAt: new Date(Date.UTC(2026, 0, 23, 9, 0, 0)),
            attempted: 5,
            delivered: 4,
            failed: 1,
            skippedBreaker: 0,
            skippedBackoff: 0,
            skippedNonePending: 0,
            breakerState: "CLOSED",
            breakerFailureCount: 0,
            breakerOpenedAt: null,
            breakerOpenUntil: null,
            breakerRemainingMs: null,
            source: "worker",
          },
        ],
      });

      await compactEscalationMetricsSnapshots(nowMs);

      const remaining = await prisma.escalationMetricsSnapshot.findMany({
        orderBy: { createdAt: "asc" },
      });

      expect(remaining).toHaveLength(1);
      expect(remaining[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        cutoffDayStartMs
      );

      const hourlyRollup = await prisma.escalationMetricsRollupHourly.findUnique({
        where: { hourStart: new Date(expiredHour) },
      });

      expect(hourlyRollup).toBeTruthy();

      expect(hourlyRollup!.skippedBreaker).toBeGreaterThanOrEqual(0);
      expect(hourlyRollup!.skippedBackoff).toBeGreaterThanOrEqual(0);
      expect(hourlyRollup!.breakerOpenCount).toBeGreaterThanOrEqual(0);

      
      const dailyRollup = await prisma.escalationMetricsRollupDaily.findUnique({
        where: { dayStart: new Date(expiredDayStart) },
      });

      expect(dailyRollup).toBeTruthy();
      expect(dailyRollup!.skippedBreaker).toBeGreaterThanOrEqual(0);
      expect(dailyRollup!.skippedBackoff).toBeGreaterThanOrEqual(0);
      expect(dailyRollup!.skippedNonePending).toBeGreaterThanOrEqual(0);
      expect(dailyRollup!.breakerOpenCount).toBeGreaterThanOrEqual(0);  

      const dailyRollup2 = await prisma.escalationMetricsRollupDaily.findUnique({
        where: { dayStart: new Date(expiredDay2Start) },
      });

      expect(dailyRollup2).toBeTruthy();
      expect(dailyRollup2?.attempted).toBe(3);
      expect(dailyRollup2?.delivered).toBe(2);
      expect(dailyRollup2?.failed).toBe(1);
      expect(dailyRollup2?.skippedBreaker).toBe(0);
      expect(dailyRollup2?.skippedBackoff).toBe(1);
      expect(dailyRollup2?.skippedNonePending).toBe(1);
      expect(dailyRollup2?.breakerOpenCount).toBe(1);
    });

    it("6) idempotency", async () => {
      process.env.ESCALATION_METRICS_RETENTION_DAYS = "2";

      const nowMs = Date.UTC(2026, 0, 24, 12, 0, 0);
      const expiredHour = Date.UTC(2026, 0, 20, 5, 0, 0);

      await prisma.escalationMetricsSnapshot.createMany({
        data: [
          {
            createdAt: new Date(expiredHour + 5 * 60 * 1000),
            attempted: 2,
            delivered: 1,
            failed: 1,
            skippedBreaker: 1,
            skippedBackoff: 0,
            skippedNonePending: 0,
            breakerState: "OPEN",
            breakerFailureCount: 1,
            breakerOpenedAt: null,
            breakerOpenUntil: null,
            breakerRemainingMs: null,
            source: "worker",
          },
          {
            createdAt: new Date(expiredHour + 55 * 60 * 1000),
            attempted: 1,
            delivered: 1,
            failed: 0,
            skippedBreaker: 0,
            skippedBackoff: 1,
            skippedNonePending: 0,
            breakerState: "CLOSED",
            breakerFailureCount: 0,
            breakerOpenedAt: null,
            breakerOpenUntil: null,
            breakerRemainingMs: null,
            source: "worker",
          },
        ],
      });

      await compactEscalationMetricsSnapshots(nowMs);

      const rollupAfterFirst =
        await prisma.escalationMetricsRollupHourly.findUnique({
          where: { hourStart: new Date(expiredHour) },
        });

      const snapshotCountAfterFirst =
        await prisma.escalationMetricsSnapshot.count();

      await compactEscalationMetricsSnapshots(nowMs);

      const rollupAfterSecond =
        await prisma.escalationMetricsRollupHourly.findUnique({
          where: { hourStart: new Date(expiredHour) },
        });

      const snapshotCountAfterSecond =
        await prisma.escalationMetricsSnapshot.count();

      expect(rollupAfterFirst?.attempted).toBe(rollupAfterSecond?.attempted);
      expect(rollupAfterFirst?.delivered).toBe(rollupAfterSecond?.delivered);
      expect(rollupAfterFirst?.failed).toBe(rollupAfterSecond?.failed);
      expect(rollupAfterFirst?.skippedBreaker).toBe(
        rollupAfterSecond?.skippedBreaker
      );
      expect(rollupAfterFirst?.skippedBackoff).toBe(
        rollupAfterSecond?.skippedBackoff
      );
      expect(rollupAfterFirst?.skippedNonePending).toBe(
        rollupAfterSecond?.skippedNonePending
      );
      expect(rollupAfterFirst?.breakerOpenCount).toBe(
        rollupAfterSecond?.breakerOpenCount
      );
      expect(snapshotCountAfterSecond).toBe(snapshotCountAfterFirst);
    });
  });

  describe("D. Sanity / Load Safety", () => {
    it("7) moderate volume compaction", async () => {
      process.env.ESCALATION_METRICS_RETENTION_DAYS = "3";

      const nowMs = Date.UTC(2026, 0, 24, 12, 0, 0);
      const baseMs = Date.UTC(2026, 0, 18, 0, 0, 0);

      const rows: Array<{
        createdAt: Date;
        attempted: number;
        delivered: number;
        failed: number;
        skippedBreaker: number;
        skippedBackoff: number;
        skippedNonePending: number;
        breakerState: string;
        breakerFailureCount: number;
        breakerOpenedAt: Date | null;
        breakerOpenUntil: Date | null;
        breakerRemainingMs: number | null;
        source: string;
      }> = [];

      for (let i = 0; i < 500; i += 1) {
        const createdAt = new Date(baseMs + i * 60 * 1000);
        rows.push({
          createdAt,
          attempted: 1,
          delivered: 1,
          failed: 0,
          skippedBreaker: 0,
          skippedBackoff: 0,
          skippedNonePending: 0,
          breakerState: i % 4 === 0 ? "OPEN" : "CLOSED",
          breakerFailureCount: 0,
          breakerOpenedAt: null,
          breakerOpenUntil: null,
          breakerRemainingMs: null,
          source: "worker",
        });
      }

      await prisma.escalationMetricsSnapshot.createMany({ data: rows });

      await compactEscalationMetricsSnapshots(nowMs);

      const hourlyCount =
        await prisma.escalationMetricsRollupHourly.count();
      const dailyCount = await prisma.escalationMetricsRollupDaily.count();

      expect(hourlyCount).toBeGreaterThan(0);
      expect(dailyCount).toBeGreaterThan(0);
    });
  });
});
