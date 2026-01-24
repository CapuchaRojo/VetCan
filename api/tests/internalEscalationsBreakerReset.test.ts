import request from "supertest";
import app from "../src/app";
import { getTestToken } from "./helpers/auth";
import { escalationMetrics } from "../src/worker/escalationMetrics";
import {
  resetBreakerForTests,
  setBreakerStateForTests,
} from "../src/worker/processDeliveries";

describe("Internal Escalations Breaker Reset API", () => {
  afterEach(() => {
    resetBreakerForTests();
    jest.restoreAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).post(
      "/api/internal/escalations/breaker/reset"
    );

    expect([401, 403]).toContain(res.status);
  });

  it("resets breaker state and returns snapshot", async () => {
    const fixedNow = 1_700_000_000_000;
    jest.spyOn(Date, "now").mockReturnValue(fixedNow);

    setBreakerStateForTests({
      state: "OPEN",
      consecutiveFailures: 2,
      openedAtMs: fixedNow - 5_000,
      halfOpenProbeInFlight: true,
      lastDeniedLogAt: fixedNow - 1_000,
    });

    const countersBefore = { ...escalationMetrics.counters };
    const token = getTestToken();

    const res = await request(app)
      .post("/api/internal/escalations/breaker/reset")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      nowMs: fixedNow,
      breaker: {
        state: "CLOSED",
        failureCount: 0,
        openedAtMs: null,
        openUntilMs: null,
        remainingOpenMs: null,
      },
    });

    expect(escalationMetrics.counters).toEqual(countersBefore);
  });
});
