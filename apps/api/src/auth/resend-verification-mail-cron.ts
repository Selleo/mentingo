import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { AuthService } from "src/auth/auth.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

@Injectable()
export class ResendVerificationMailCron {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  @Cron("0 9 * * *")
  async resendVerificationMail() {
    await this.tenantRunner.runForEachTenant(async () => {
      await this.authService.checkTokenExpiryAndSendEmail();
    });
  }
}
