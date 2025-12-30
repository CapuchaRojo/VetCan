import twilio, { Twilio } from 'twilio';

let client: Twilio | null = null;

/**
 * Lazily initialize Twilio client.
 * This prevents API startup crashes if Twilio is misconfigured.
 */
function getClient(): Twilio | null {
  if (client) return client;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
  
    if (!accountSid || !authToken) {
      console.warn('[NOTIFY] Twilio credentials missing. SMS disabled.');
      return null;
    }
 
    if (!accountSid.startsWith('AC')) {
      console.warn('[NOTIFY] Invalid Twilio Account SID format. SMS disabled.');
    }

    client = twilio(accountSid, authToken);
    return client;
  }

export const notificationProvider = {
  /**
   * Send an SMS message (fails gracefully if Twilio is unavailable)
   */
  async send(to: string, message: string) {
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const twilioClient = getClient();

    if (!twilioClient || !fromNumber) {
      console.warn('[NOTIFY] TWILIO_FROM_NUMBER not set. Message:', message);
      return;
    }

    try {
      const result = await twilioClient.messages.create({
        from: fromNumber,
        to,
        body: message,
      }); 

      console.log('[NOTIFY] SMS sent:', result.sid);
    } catch (err) {
      console.error('[NOTIFY] Failed to send SMS:', err);
    }
  },
};
