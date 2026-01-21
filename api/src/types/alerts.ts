export interface AlertEscalationPayload {
  alertType: string;
  eventName: string;
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  environment: string;
  triggeredAt: string;
  correlationId?: string;
  ageSeconds: number;
  callSid?: string;
}
