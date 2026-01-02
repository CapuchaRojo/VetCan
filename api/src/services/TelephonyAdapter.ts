export interface TelephonyAdapter {
dial(phone: string, opts?: any): Promise<any>;
hangup(callSid: string): Promise<any>;
webhookHandler(req: any, res: any): Promise<any>;
}
