import request from "supertest";
import app from "../src/app";
import { getTestToken } from "./helpers/auth";

describe("Internal Metrics API", () => {
  it("GET /api/internal/metrics returns a stable shape", async () => {
    const token = getTestToken();
    const res = await request(app)
      .get("/api/internal/metrics")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("environment");
    expect(res.body).toHaveProperty("uptimeSeconds");
    expect(res.body).toHaveProperty("lastUpdated");
    expect(res.body).toHaveProperty("eventCounts");
    expect(res.body).toHaveProperty("activeAlerts");
    expect(res.body).toHaveProperty("status", "ok");

    expect(res.body.eventCounts).toHaveProperty("callback_requested");
    expect(res.body.eventCounts).toHaveProperty("alert_triggered");
    expect(res.body.eventCounts).toHaveProperty("sms_received");
    expect(res.body.eventCounts).toHaveProperty("voice_call_started");
  });
});
