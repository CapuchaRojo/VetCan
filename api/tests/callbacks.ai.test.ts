// api/tests/callbacks.ai.test.ts

import request from "supertest";
import prisma from "../src/prisma";
import app from "../src/app";

describe("AI Callback (manual) — compliance guardrails", () => {
  it("flags medical questions for staff follow-up and stores no PHI", async () => {
    // 1. Create a pending callback
    const callback = await prisma.callbackRequest.create({
      data: {
        name: "Compliance Test Vet",
        phone: "+15555550999",
        status: "pending",
        requestType: "general_question",
      },
    });

    // 2. Attempt AI callback with medical content
    const res = await request(app)
      .post(`/api/callbacks/${callback.id}/ai-call`)
      .send({
        simulation: true, // 🔒 FORCE simulation
        simulatedReason: "Which cannabis strain helps PTSD?",
        simulatedMedicalQuestion: true,
    });

    // 3. Validate API response
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.staffFollowupRequired).toBe(true);

    // 4. Validate DB state
    const updated = await prisma.callbackRequest.findUnique({
      where: { id: callback.id },
    });

    expect(updated).toBeTruthy();
    expect(updated?.status).toBe("needs_staff");
    expect(updated?.aiHandled).toBe(true);
    expect(updated?.staffFollowupRequired).toBe(true);

    // 5. Verify summary is non-medical
    expect(updated?.summary).toMatch(/staff/i);
    expect(updated?.summary?.toLowerCase()).not.toMatch(/ptsd|strain|medical/);

    // 6. Verify NO PHI fields stored
    expect(updated?.nonMedicalReason).toBeNull();
  });
});
