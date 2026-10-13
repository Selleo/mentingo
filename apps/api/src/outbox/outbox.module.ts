import { Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { OutboxDirectHandlerService } from "./outbox-direct-handler.service";
import { OutboxDispatcherCron } from "./outbox-dispatcher.cron";
import { OutboxDispatcherService } from "./outbox-dispatcher.service";
import { OutboxListenerService } from "./outbox-listener.service";
import { OutboxNotificationPreparationService } from "./outbox-notification-preparation.service";
import { isOutboxProcessingEnabled } from "./outbox.constants";
import { OutboxPublisher } from "./outbox.publisher";
import { OutboxRepository } from "./outbox.repository";

@Global()
@Module({
  imports: [CqrsModule],
  providers: [
    OutboxRepository,
    OutboxPublisher,
    OutboxDirectHandlerService,
    OutboxNotificationPreparationService,
    OutboxDispatcherService,
    ...(isOutboxProcessingEnabled() ? [OutboxDispatcherCron, OutboxListenerService] : []),
  ],
  exports: [OutboxPublisher, OutboxDirectHandlerService, OutboxNotificationPreparationService],
})
export class OutboxModule {}
