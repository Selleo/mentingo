import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { SupportModeService } from "./support-mode.service";

@Injectable()
export class SupportModeExpiredSessionsCron {
  private readonly logger = new Logger(SupportModeExpiredSessionsCron.name);

  constructor(private readonly supportModeService: SupportModeService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async revokeExpiredSessions() {
    const revokedCount = await this.supportModeService.closeExpiredSessions();

    if (revokedCount > 0) this.logger.log(`Revoked ${revokedCount} expired support sessions.`);
  }
}
