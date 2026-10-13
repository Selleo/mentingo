import { Injectable } from "@nestjs/common";

import type { OutboxNotificationPreparer } from "./outbox.types";

/** Prepares complete notification occurrences in the originating publish operation. */
@Injectable()
export class OutboxNotificationPreparationService {
  private readonly preparers: OutboxNotificationPreparer[] = [];

  register(preparer: OutboxNotificationPreparer): void {
    this.preparers.push(preparer);
  }

  async prepare(event: object): Promise<object[]> {
    const notifications: object[] = [];
    for (const preparer of this.preparers) {
      const preparedNotifications = await preparer(event);
      notifications.push(...preparedNotifications);
    }

    return notifications;
  }
}
