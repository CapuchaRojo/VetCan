export interface TelephonyAdapter {
  dial(number: string, metadata?: any): Promise<any>;
  hangup(callId: string): Promise<any>;
  createInboundWebhook(req: any): Promise<any>;
}
