import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { SettingsModule } from "src/settings/settings.module";
import { SettingsService } from "src/settings/settings.service";

import { CertificateRepository } from "./certificate.repository";
import { CertificatesController } from "./certificates.controller";
import { CertificatesService } from "./certificates.service";

@Module({
  imports: [SettingsModule, FileModule],
  controllers: [CertificatesController],
  providers: [CertificatesService, CertificateRepository, SettingsService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
