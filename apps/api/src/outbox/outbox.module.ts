import { Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { OutboxDispatcherCron } from "./outbox-dispatcher.cron";
import { OutboxDispatcherService } from "./outbox-dispatcher.service";
import { OutboxEventHandlerRegistry } from "./outbox-event-handler-registry";
import { OutboxListenerService } from "./outbox-listener.service";
import { isOutboxProcessingEnabled } from "./outbox.constants";
import { OutboxPublisher } from "./outbox.publisher";
import { OutboxRepository } from "./outbox.repository";

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    OutboxRepository,
    OutboxPublisher,
    OutboxDispatcherService,
    OutboxEventHandlerRegistry,
    ...(isOutboxProcessingEnabled() ? [OutboxDispatcherCron, OutboxListenerService] : []),
  ],
  exports: [OutboxPublisher],
})
export class OutboxModule {}
