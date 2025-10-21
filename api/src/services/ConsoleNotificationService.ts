import { NotificationService } from './types';
import { UUID } from '../models/base';

export class ConsoleNotificationService implements NotificationService {
  async notifyUser(userId: UUID, payload: { title: string; body: string; data?: Record<string, unknown> }): Promise<void> {
    console.info(`[NOTIFY] ${userId} -> ${payload.title}: ${payload.body}`, payload.data ?? {});
  }
}
