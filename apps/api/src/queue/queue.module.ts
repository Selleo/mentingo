import { Global, Module } from "@nestjs/common";

import { QueueService } from "src/queue/queue.service";

@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
