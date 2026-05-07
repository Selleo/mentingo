import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import postgres from "postgres";

import { OutboxDispatcherService } from "./outbox-dispatcher.service";
import { OUTBOX_NOTIFY_CHANNEL } from "./outbox.constants";

import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";

@Injectable()
export class OutboxListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxListenerService.name);
  private readonly client: postgres.Sql;
  private listenMeta: postgres.ListenMeta | null = null;
  private dispatchScheduled: NodeJS.Immediate | null = null;
  private isShuttingDown = false;

  constructor(
    configService: ConfigService,
    private readonly outboxDispatcherService: OutboxDispatcherService,
  ) {
    this.client = postgres(configService.get<string>("database.urlApp")!, {
      max: 1,
      idle_timeout: 0,
      max_lifetime: 0,
    });
  }

  async onModuleInit(): Promise<void> {
    this.listenMeta = await this.client.listen(
      OUTBOX_NOTIFY_CHANNEL,
      () => this.scheduleDispatch(),
      () => this.logger.log(`Listening for ${OUTBOX_NOTIFY_CHANNEL} notifications`),
    );

    this.scheduleDispatch();
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    if (this.dispatchScheduled) {
      clearImmediate(this.dispatchScheduled);
      this.dispatchScheduled = null;
    }

    await this.listenMeta?.unlisten();
    await this.client.end({ timeout: 5 });
  }

  private scheduleDispatch(): void {
    if (this.isShuttingDown || this.dispatchScheduled) return;

    this.dispatchScheduled = setImmediate(async () => {
      this.dispatchScheduled = null;

      try {
        await this.outboxDispatcherService.dispatchPendingEvents();
      } catch (error) {
        this.logger.error(`Failed dispatching outbox events after notification: ${error}`);
      }
    });
  }
}
