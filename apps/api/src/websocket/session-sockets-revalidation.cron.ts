import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { SessionSocketsRevalidationService } from "./session-sockets-revalidation.service";

/** Runs on every API instance, because each instance can only see its own sockets. */
@Injectable()
export class SessionSocketsRevalidationCron {
  constructor(
    private readonly sessionSocketsRevalidationService: SessionSocketsRevalidationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async disconnectRevokedSessionSockets() {
    await this.sessionSocketsRevalidationService.disconnectRevokedSessionSockets();
  }
}
