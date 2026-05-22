import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CertificatesService } from "./certificates.service";

@Injectable()
export class CertificatesCron {
  private readonly logger = new Logger(CertificatesCron.name);

  constructor(
    private readonly certificatesService: CertificatesService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processCertificateExpirationWarnings() {
    await this.tenantRunner.runForEachTenant(async (tenantId) => {
      try {
        await this.certificatesService.sendCertificateExpirationWarnings();
      } catch (error) {
        this.logger.error(
          `Failed to process certificate expiration warnings for tenant ${tenantId}`,
          error,
        );
      }
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processCertificatesExpires() {
    await this.tenantRunner.runForEachTenant(async (tenantId) => {
      try {
        await this.certificatesService.expireCertificates();
      } catch (error) {
        this.logger.error(`Failed to process certificate expiration for tenant ${tenantId}`, error);
      }
    });
  }
}
