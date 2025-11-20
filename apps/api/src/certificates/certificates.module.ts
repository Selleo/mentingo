import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";
import { SettingsModule } from "src/settings/settings.module";
import { SettingsService } from "src/settings/settings.service";

import { CertificateRepository } from "./certificate.repository";
import { CertificatesController } from "./certificates.controller";
import { CertificatesService } from "./certificates.service";

@Module({
  imports: [SettingsModule, FileModule, LocalizationModule],
  controllers: [CertificatesController],
  providers: [CertificatesService, CertificateRepository, SettingsService, LocalizationService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
