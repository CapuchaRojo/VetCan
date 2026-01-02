import { TelephonyAdapter } from './TelephonyAdapter';
import twilio from 'twilio';


export class TwilioAdapter implements TelephonyAdapter {
client: any;
constructor() {
this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}
async dial(phone: string) {
return this.client.calls.create({
to: phone,
from: process.env.TWILIO_NUMBER,
url: `${process.env.TWILIO_WEBHOOK_BASE}/twilio/outbound`
});
}
async hangup(callSid: string) {
return this.client.calls(callSid).update({ status: 'completed' });
}
async webhookHandler(req: any, res: any) {
// Minimal handler: acknowledge
res.type('text/xml');
res.send('<Response></Response>');
}
}
