import request from "supertest";
import app from "../src/app";
import { getTestToken } from "./helpers/auth";

describe("Internal Escalations Status API", () => {
  it("GET /api/internal/escalations/status returns breaker and counters", async () => {
    const token = getTestToken();
    const res = await request(app)
      .get("/api/internal/escalations/status")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("nowMs");
    expect(res.body).toHaveProperty("breaker");
    expect(res.body).toHaveProperty("counters");

    expect(res.body.breaker).toHaveProperty("state");
    expect(res.body.breaker).toHaveProperty("failureCount");
    expect(res.body.breaker).toHaveProperty("openedAtMs");
    expect(res.body.breaker).toHaveProperty("openUntilMs");
    expect(res.body.breaker).toHaveProperty("remainingOpenMs");

    expect(res.body.counters).toHaveProperty("attempted");
    expect(res.body.counters).toHaveProperty("delivered");
    expect(res.body.counters).toHaveProperty("failed");
    expect(res.body.counters).toHaveProperty("skippedBreaker");
    expect(res.body.counters).toHaveProperty("skippedBackoff");
    expect(res.body.counters).toHaveProperty("skippedNonePending");
  });
});
