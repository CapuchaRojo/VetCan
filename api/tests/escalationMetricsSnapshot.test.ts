import prisma from "../src/prisma";
import { escalationMetrics } from "../src/worker/escalationMetrics";
import { captureEscalationMetricsSnapshot } from "../src/worker/processDeliveries";

describe("Escalation Metrics Snapshot", () => {
  beforeEach(async () => {
    await prisma.escalationMetricsSnapshot.deleteMany();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("writes a snapshot row with counters and breaker fields", async () => {
    const fixedNow = 1_700_000_100_000;
    jest.spyOn(Date, "now").mockReturnValue(fixedNow);

    const countersBefore = { ...escalationMetrics.counters };
    escalationMetrics.counters.attempted = 5;
    escalationMetrics.counters.delivered = 3;
    escalationMetrics.counters.failed = 2;
    escalationMetrics.counters.skippedBreaker = 1;
    escalationMetrics.counters.skippedBackoff = 4;
    escalationMetrics.counters.skippedNonePending = 7;

    await captureEscalationMetricsSnapshot(fixedNow);

    const snapshots = await prisma.escalationMetricsSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    expect(snapshots).toHaveLength(1);
    const snapshot = snapshots[0];

    expect(snapshot.source).toBe("worker");
    expect(snapshot.attempted).toBe(5);
    expect(snapshot.delivered).toBe(3);
    expect(snapshot.failed).toBe(2);
    expect(snapshot.skippedBreaker).toBe(1);
    expect(snapshot.skippedBackoff).toBe(4);
    expect(snapshot.skippedNonePending).toBe(7);
    expect(snapshot.breakerState).toBe("CLOSED");
    expect(snapshot.breakerFailureCount).toBe(0);
    expect(snapshot.breakerOpenedAt).toBeNull();
    expect(snapshot.breakerOpenUntil).toBeNull();
    expect(snapshot.breakerRemainingMs).toBeNull();

    expect(escalationMetrics.counters).toEqual({
      attempted: 5,
      delivered: 3,
      failed: 2,
      skippedBreaker: 1,
      skippedBackoff: 4,
      skippedNonePending: 7,
    });

    escalationMetrics.counters.attempted = countersBefore.attempted;
    escalationMetrics.counters.delivered = countersBefore.delivered;
    escalationMetrics.counters.failed = countersBefore.failed;
    escalationMetrics.counters.skippedBreaker = countersBefore.skippedBreaker;
    escalationMetrics.counters.skippedBackoff = countersBefore.skippedBackoff;
    escalationMetrics.counters.skippedNonePending =
      countersBefore.skippedNonePending;
  });
});
