// api/src/services/outboundCall.ts
import twilio, { Twilio } from "twilio";

let client: Twilio | null = null;

function getTwilioClient(): Twilio {
  if (!client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;

    if (!sid || !token) {
      throw new Error("Twilio credentials not configured");
    }

    if (!sid.startsWith("AC")) {
      throw new Error("Invalid Twilio Account SID format");
    }

    client = twilio(sid, token);
  }

  return client;
}

export interface OutboundCallParams {
  to: string;
  from: string;
  twiml?: string;
  url?: string;
}

/**
 * Places an outbound call via Twilio.
 * This function is safe to import in tests (lazy Twilio init).
 */
export async function makeOutboundCall(
  params: OutboundCallParams
) {
  const twilioClient = getTwilioClient();

  return twilioClient.calls.create({
    to: params.to,
    from: params.from,
    twiml: params.twiml,
    url: params.url,
  });
}
