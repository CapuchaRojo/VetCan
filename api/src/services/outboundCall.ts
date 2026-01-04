import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function placeOutboundCall(to: string) {
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!from) {
    throw new Error("TWILIO_FROM_NUMBER is not defined");
  }

  return client.calls.create({
    to,
    from,
    url: `${process.env.PUBLIC_BASE_URL}/api/voice/outbound`,
  });
}
