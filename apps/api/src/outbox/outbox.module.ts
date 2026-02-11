import { Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { OutboxDispatcherCron } from "./outbox-dispatcher.cron";
import { OutboxDispatcherService } from "./outbox-dispatcher.service";
import { OutboxPublisher } from "./outbox.publisher";
import { OutboxRepository } from "./outbox.repository";

@Global()
@Module({
  imports: [CqrsModule],
  providers: [OutboxRepository, OutboxPublisher, OutboxDispatcherService, OutboxDispatcherCron],
  exports: [OutboxPublisher],
})
export class OutboxModule {}
