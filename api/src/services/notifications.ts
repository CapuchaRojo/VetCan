// api/src/services/notifications.ts

export interface NotificationProvider {
  send(to: string, message: string): Promise<void>;
}

export class ConsoleNotificationProvider implements NotificationProvider {
  async send(to: string, message: string): Promise<void> {
    console.log(`[NOTIFY] To: ${to} | ${message}`);
  }
}

// Single provider instance (easy to swap later)
export const notificationProvider = new ConsoleNotificationProvider();
