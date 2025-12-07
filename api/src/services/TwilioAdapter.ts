import { TelephonyAdapter } from "./TelephonyAdapter";
import twilio from "twilio";

export class TwilioService implements TelephonyAdapter {
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  async dial(number: string) {
    return this.client.calls.create({
      to: number,
      from: process.env.TWILIO_NUMBER,
      url: "https://example.com/twilio/outbound"
    });
  }

  async hangup(callId: string) {
    return this.client.calls(callId).update({ status: "completed" });
  }

  async createInboundWebhook(req: any) {
    return { ok: true, message: "Inbound webhook received" };
  }
}
