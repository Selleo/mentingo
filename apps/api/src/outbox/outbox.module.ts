import { Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { OutboxDispatcherCron } from "./outbox-dispatcher.cron";
import { OutboxDispatcherService } from "./outbox-dispatcher.service";
import { OutboxListenerService } from "./outbox-listener.service";
import { isOutboxProcessingEnabled } from "./outbox.constants";
import { OutboxPublisher } from "./outbox.publisher";
import { OutboxRepository } from "./outbox.repository";

@Global()
@Module({
  imports: [CqrsModule],
  providers: [
    OutboxRepository,
    OutboxPublisher,
    OutboxDispatcherService,
    ...(isOutboxProcessingEnabled() ? [OutboxDispatcherCron, OutboxListenerService] : []),
  ],
  exports: [OutboxPublisher],
})
export class OutboxModule {}
