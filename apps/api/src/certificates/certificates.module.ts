import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/emails/emails.module";
import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";
import { S3Module } from "src/s3/s3.module";
import { SettingsModule } from "src/settings/settings.module";
import { SettingsService } from "src/settings/settings.service";

import { CertificateRepository } from "./certificate.repository";
import { CertificatesController } from "./certificates.controller";
import { CertificatesCron } from "./certificates.cron";
import { CertificatesService } from "./certificates.service";
import { CertificateEmailHandler } from "./handlers/certificate-email.handler";

@Module({
  imports: [SettingsModule, FileModule, LocalizationModule, S3Module, EmailModule],
  controllers: [CertificatesController],
  providers: [
    CertificatesService,
    CertificateRepository,
    CertificatesCron,
    CertificateEmailHandler,
    SettingsService,
    LocalizationService,
  ],
  exports: [CertificatesService],
})
export class CertificatesModule {}
